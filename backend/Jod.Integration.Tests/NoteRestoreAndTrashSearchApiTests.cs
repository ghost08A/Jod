using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Jod.Integration.Tests;

public class NoteRestoreAndTrashSearchApiTests : IClassFixture<JodWebFactory>
{
    private const string NotFoundMessage = "ไม่พบโน้ตนี้";

    private readonly JodWebFactory _factory;

    public NoteRestoreAndTrashSearchApiTests(JodWebFactory factory) => _factory = factory;

    // ---- restore ----

    [Fact]
    public async Task Restore_HeadOfABranch_WithAliveParent_BringsTheWholeBranchBack_AsLastChild()
    {
        // Arrange: root -> [keep, head -> [h1 -> h2]]; delete the branch of head, then add a newer sibling
        var user = await SignInAsync();
        var root = await CreateAsync(user);
        await MoveAsync(user, root, "root");
        var keep = await CreateAsync(user, parentId: root);
        var head = await CreateAsync(user, parentId: root);
        var h1 = await CreateAsync(user, parentId: head);
        var h2 = await CreateAsync(user, parentId: h1);
        await DeleteAsync(user, head, "branch");
        var newer = await CreateAsync(user, parentId: root);
        var before = await VersionsAsync(user, head, h1, h2);

        // Act
        var response = await RestoreAsync(user, head);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJson(response);
        Assert.Equal(["id", "title", "updatedAt", "placement", "parentId", "position"], body.EnumerateObject().Select(p => p.Name));
        Assert.Equal(root, body.GetProperty("parentId").GetGuid());
        Assert.Equal(2, body.GetProperty("position").GetInt32());
        var list = (await ListAsync(user)).ToDictionary(n => n.GetProperty("id").GetGuid());
        Assert.Equal(6, list.Count);
        Assert.Equal(head, list[h1].GetProperty("parentId").GetGuid());
        Assert.Equal(h1, list[h2].GetProperty("parentId").GetGuid());
        Assert.Equal("child", list[head].GetProperty("placement").GetString());
        Assert.Equal(1, list[newer].GetProperty("position").GetInt32());
        Assert.Equal(0, list[keep].GetProperty("position").GetInt32());
        Assert.Empty(await TrashAsync(user));
        Assert.Equal(before, await VersionsAsync(user, head, h1, h2));
        var restored = await ReadJson(await user.Client.GetAsync($"/api/notes/{head}"));
        Assert.Equal(JsonValueKind.Null, restored.GetProperty("deletedAt").ValueKind);
    }

    [Fact]
    public async Task Restore_HeadOfARootBranch_GoesLastAmongTheRoots()
    {
        var user = await SignInAsync();
        var r1 = await CreateAsync(user);
        var victim = await CreateAsync(user);
        var child = await CreateAsync(user, parentId: victim);
        await MoveAsync(user, r1, "root");
        await MoveAsync(user, victim, "root");
        await DeleteAsync(user, victim, "branch");
        var r2 = await CreateAsync(user);
        await MoveAsync(user, r2, "root");

        var body = await ReadJson(await RestoreAsync(user, victim));

        Assert.Equal("root", body.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("parentId").ValueKind);
        Assert.Equal(2, body.GetProperty("position").GetInt32());
        Assert.Equal(victim, (await ListAsync(user)).Single(n => n.GetProperty("id").GetGuid() == child).GetProperty("parentId").GetGuid());
    }

    [Fact]
    public async Task Restore_AnUnplacedNote_StaysUnplaced()
    {
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        await DeleteAsync(user, note, "branch");

        var body = await ReadJson(await RestoreAsync(user, note));

        Assert.Equal("unplaced", body.GetProperty("placement").GetString());
    }

    [Fact]
    public async Task Restore_ANonHeadNote_ComesBackUnplaced_WithItsSameBatchDescendants()
    {
        // Arrange: top -> mid -> [leaf1, leaf2 -> deep], all deleted as one branch
        var user = await SignInAsync();
        var top = await CreateAsync(user);
        await MoveAsync(user, top, "root");
        var mid = await CreateAsync(user, parentId: top);
        var leaf1 = await CreateAsync(user, parentId: mid);
        var leaf2 = await CreateAsync(user, parentId: mid);
        var deep = await CreateAsync(user, parentId: leaf2);
        await DeleteAsync(user, top, "branch");

        // Act
        var body = await ReadJson(await RestoreAsync(user, mid));

        // Assert
        Assert.Equal("unplaced", body.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("parentId").ValueKind);
        var list = (await ListAsync(user)).ToDictionary(n => n.GetProperty("id").GetGuid());
        Assert.Equal(4, list.Count);
        Assert.Equal(mid, list[leaf1].GetProperty("parentId").GetGuid());
        Assert.Equal(leaf2, list[deep].GetProperty("parentId").GetGuid());
        Assert.Equal([top], (await TrashAsync(user)).Select(n => n.GetProperty("id").GetGuid()).ToList());
    }

    [Fact]
    public async Task Restore_WhenTheOriginalParentIsGone_ComesBackUnplaced()
    {
        // Arrange: parent -> child, then the parent is deleted as a branch and removed for good after the child is separated
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        await MoveAsync(user, parent, "root");
        var child = await CreateAsync(user, parentId: parent);
        await DeleteAsync(user, child, "single");
        await DeleteAsync(user, parent, "single");
        Assert.Equal(HttpStatusCode.OK, (await PermanentAsync(user, parent)).StatusCode);

        // Act
        var body = await ReadJson(await RestoreAsync(user, child));

        // Assert
        Assert.Equal("unplaced", body.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("parentId").ValueKind);
    }

    [Fact]
    public async Task Restore_ASingleDelete_GoesBackUnderTheOriginalParentLast_AndLiftedChildrenStay()
    {
        // Arrange: parent -> [victim -> c1, other]; delete victim alone (c1 is lifted)
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var victim = await CreateAsync(user, parentId: parent);
        var other = await CreateAsync(user, parentId: parent);
        var c1 = await CreateAsync(user, parentId: victim);
        await DeleteAsync(user, victim, "single");

        // Act
        var body = await ReadJson(await RestoreAsync(user, victim));

        // Assert
        Assert.Equal(parent, body.GetProperty("parentId").GetGuid());
        Assert.Equal(2, body.GetProperty("position").GetInt32());
        var list = (await ListAsync(user)).ToDictionary(n => n.GetProperty("id").GetGuid());
        Assert.Equal(parent, list[c1].GetProperty("parentId").GetGuid());
        Assert.Equal(parent, list[other].GetProperty("parentId").GetGuid());
    }

    [Fact]
    public async Task Restore_ASingleDelete_WhoseParentIsInTheTrash_ComesBackUnplaced_ThenParentRestoreLeavesIt()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var victim = await CreateAsync(user, parentId: parent);
        await DeleteAsync(user, victim, "single");
        await DeleteAsync(user, parent, "branch");

        var body = await ReadJson(await RestoreAsync(user, victim));

        Assert.Equal("unplaced", body.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("parentId").ValueKind);
        Assert.Equal([parent], (await TrashAsync(user)).Select(n => n.GetProperty("id").GetGuid()).ToList());
    }

    [Fact]
    public async Task Restore_NotInTrash_Missing_OrForeign_IsTheSame404()
    {
        var user = await SignInAsync();
        var other = await SignInAsync();
        var alive = await CreateAsync(user);
        var theirs = await CreateAsync(other);
        await DeleteAsync(other, theirs, "branch");
        var restoredOnce = await CreateAsync(user);
        await DeleteAsync(user, restoredOnce, "branch");
        await RestoreAsync(user, restoredOnce);

        foreach (var id in new[] { alive, theirs, Guid.NewGuid(), restoredOnce })
        {
            var response = await RestoreAsync(user, id);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal([NotFoundMessage], Errors(await ReadJson(response)));
        }
        Assert.Single(await TrashAsync(other));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().PostAsync($"/api/notes/{alive}/restore", null)).StatusCode);
    }

    // ---- permanent delete ----

    [Fact]
    public async Task Permanent_RemovesTheNoteAndItsSameBatchDescendantsOnly()
    {
        // Arrange: top -> mid -> leaf; a separate trashed note under leaf's batch neighbour
        var user = await SignInAsync();
        var top = await CreateAsync(user);
        var mid = await CreateAsync(user, parentId: top);
        var leaf = await CreateAsync(user, parentId: mid);
        var loner = await CreateAsync(user);
        await DeleteAsync(user, top, "branch");
        await DeleteAsync(user, loner, "branch");

        // Act
        var response = await PermanentAsync(user, mid);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, (await ReadJson(response)).GetProperty("deletedCount").GetInt32());
        Assert.Equal(new[] { top, loner }.Order(), (await TrashAsync(user)).Select(n => n.GetProperty("id").GetGuid()).Order());
        Assert.Equal(HttpStatusCode.NotFound, (await user.Client.GetAsync($"/api/notes/{leaf}")).StatusCode);
    }

    [Fact]
    public async Task Permanent_OfAParent_WhoseTrashedChildCameFromAnotherDelete_StillWorks()
    {
        // Arrange: child deleted alone first (still points at parent), then parent deleted
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var child = await CreateAsync(user, parentId: parent);
        await DeleteAsync(user, child, "single");
        await DeleteAsync(user, parent, "branch");

        var response = await PermanentAsync(user, parent);

        Assert.Equal(1, (await ReadJson(response)).GetProperty("deletedCount").GetInt32());
        Assert.Equal([child], (await TrashAsync(user)).Select(n => n.GetProperty("id").GetGuid()).ToList());
    }

    [Fact]
    public async Task Permanent_AliveMissingOrForeign_Is404_AndNothingIsRemoved()
    {
        var user = await SignInAsync();
        var other = await SignInAsync();
        var alive = await CreateAsync(user);
        var theirs = await CreateAsync(other);
        await DeleteAsync(other, theirs, "branch");

        foreach (var id in new[] { alive, theirs, Guid.NewGuid() })
        {
            var response = await PermanentAsync(user, id);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal([NotFoundMessage], Errors(await ReadJson(response)));
        }
        Assert.Single(await ListAsync(user));
        Assert.Single(await TrashAsync(other));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().DeleteAsync($"/api/notes/{alive}/permanent")).StatusCode);
    }

    // ---- search: filter by parent ----

    [Fact]
    public async Task Search_ByParent_FindsTheWholeBranchIncludingTheParent_NotOutsideNorTrash()
    {
        // Arrange: top -> a -> b -> c (deep), outside note, and a trashed note inside the branch
        var user = await SignInAsync();
        var top = await CreateAsync(user, title: "word top");
        var a = await CreateAsync(user, title: "word a", parentId: top);
        var b = await CreateAsync(user, title: "x", text: "word b", parentId: a);
        var c = await CreateAsync(user, title: "word c", parentId: b);
        var gone = await CreateAsync(user, title: "word gone", parentId: a);
        await CreateAsync(user, title: "word outside");
        await DeleteAsync(user, gone, "single");

        // Act
        var whole = await SearchAsync(user, "word", $"parentId={top}");
        var inner = await SearchAsync(user, "word", $"parentId={a}");

        // Assert
        Assert.Equal(new[] { top, a, b, c }.Order(), Ids(whole).Order());
        Assert.Equal(new[] { a, b, c }.Order(), Ids(inner).Order());
        Assert.Equal([top, a, b], Items(whole).First(i => i.GetProperty("id").GetGuid() == c).GetProperty("path").EnumerateArray().Select(p => p.GetProperty("id").GetGuid()).ToList());
    }

    [Fact]
    public async Task Search_ByParent_MissingForeignOrDeleted_Is404()
    {
        var user = await SignInAsync();
        var other = await SignInAsync();
        var theirs = await CreateAsync(other, title: "word");
        var gone = await CreateAsync(user, title: "word");
        await DeleteAsync(user, gone, "branch");

        foreach (var id in new[] { theirs, gone, Guid.NewGuid() })
        {
            var response = await user.Client.GetAsync($"/api/notes/search?q=word&parentId={id}");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }

    [Fact]
    public async Task Search_ParentIdTogetherWithInTrash_Is400()
    {
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "word");

        var response = await user.Client.GetAsync($"/api/notes/search?q=word&parentId={note}&inTrash=true");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- search: in the Trash ----

    [Fact]
    public async Task Search_InTrash_FindsOnlyTrashedNotes_InTheSameOrder_WithTheOriginalPath()
    {
        // Arrange: top (root) -> mid -> [titleHit, contentHit]; alive note matches too; whole branch deleted
        var user = await SignInAsync();
        var top = await CreateAsync(user, title: "Top");
        await MoveAsync(user, top, "root");
        var mid = await CreateAsync(user, title: "Mid", parentId: top);
        var contentHit = await CreateAsync(user, title: "plain", text: "needle", parentId: mid);
        var titleHit = await CreateAsync(user, title: "needle title", parentId: mid);
        var alive = await CreateAsync(user, title: "needle alive");
        await DeleteAsync(user, top, "branch");

        // Act
        var page = await SearchAsync(user, "needle", "inTrash=true");
        var normal = await SearchAsync(user, "needle");

        // Assert
        Assert.Equal([titleHit, contentHit], Ids(page));
        Assert.Equal([alive], Ids(normal));
        Assert.Equal(["id", "title", "updatedAt", "path", "snippet"], Items(page)[0].EnumerateObject().Select(p => p.Name));
        Assert.Equal(["Top", "Mid"], Items(page)[0].GetProperty("path").EnumerateArray().Select(p => p.GetProperty("title").GetString()).ToList());
        Assert.Contains("needle", Items(page)[1].GetProperty("snippet").GetString());
    }

    [Fact]
    public async Task Search_InTrash_PathEndsAtAnAncestorThatWasRemovedForGood_AndNeverShowsOtherUsers()
    {
        // Arrange: root -> mid -> leaf; leaf and mid are trashed one by one, mid then removed for good
        var user = await SignInAsync();
        var other = await SignInAsync();
        var root = await CreateAsync(user, title: "Root");
        await MoveAsync(user, root, "root");
        var mid = await CreateAsync(user, title: "Mid", parentId: root);
        var leaf = await CreateAsync(user, title: "leafword", parentId: mid);
        var theirs = await CreateAsync(other, title: "leafword");
        await DeleteAsync(other, theirs, "branch");
        await DeleteAsync(user, leaf, "single");
        await DeleteAsync(user, mid, "single");
        await PermanentAsync(user, mid);

        // Act
        var page = await SearchAsync(user, "leafword", "inTrash=true");

        // Assert
        Assert.Equal([leaf], Ids(page));
        Assert.Empty(Items(page)[0].GetProperty("path").EnumerateArray());
    }

    [Fact]
    public async Task Search_InTrash_NeverPutsTheQueryInTheLogs()
    {
        var marker = "secret-" + Guid.NewGuid().ToString("N");
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: marker);
        await DeleteAsync(user, note, "branch");

        await SearchAsync(user, marker, "inTrash=true");
        await user.Client.GetAsync($"/api/notes/search?q={marker}&parentId={Guid.NewGuid()}");
        await user.Client.GetAsync($"/api/notes/search?q={marker}&parentId={note}&inTrash=true");

        Assert.DoesNotContain(_factory.LogEntries, entry =>
            entry.Message.Contains(marker) || (entry.ExceptionText?.Contains(marker) ?? false));
    }

    // ---- helpers ----

    private record TestUser(HttpClient Client, Guid UserId);

    private async Task<TestUser> SignInAsync()
    {
        var client = _factory.CreateClient();
        var response = await TestGoogle.SignInAsync(client);
        response.EnsureSuccessStatusCode();
        var body = await ReadJson(response);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("accessToken").GetString());
        return new TestUser(client, body.GetProperty("user").GetProperty("id").GetGuid());
    }

    private static string ContentOf(string text) =>
        $"{{\"schemaVersion\":1,\"blocks\":[{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"paragraph\",\"text\":{JsonSerializer.Serialize(text)}}}]}}";

    private static async Task<Guid> CreateAsync(TestUser user, string? title = null, string? text = null, Guid? parentId = null)
    {
        var body = new Dictionary<string, object?>();
        if (title is not null)
        {
            body["title"] = title;
        }
        if (parentId is not null)
        {
            body["parentId"] = parentId;
        }
        if (text is not null)
        {
            body["content"] = JsonDocument.Parse(ContentOf(text)).RootElement;
        }
        var response = await user.Client.PostAsync("/api/notes", Json(JsonSerializer.Serialize(body)));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private static Task<HttpResponseMessage> DeleteAsync(TestUser user, Guid id, string scope) =>
        user.Client.DeleteAsync($"/api/notes/{id}?scope={scope}");

    private static Task<HttpResponseMessage> RestoreAsync(TestUser user, Guid id) =>
        user.Client.PostAsync($"/api/notes/{id}/restore", null);

    private static Task<HttpResponseMessage> PermanentAsync(TestUser user, Guid id) =>
        user.Client.DeleteAsync($"/api/notes/{id}/permanent");

    private static async Task MoveAsync(TestUser user, Guid id, string placement) =>
        (await user.Client.PutAsync($"/api/notes/{id}/placement", Json($"{{\"placement\":\"{placement}\"}}"))).EnsureSuccessStatusCode();

    private static async Task<List<JsonElement>> ListAsync(TestUser user) =>
        (await ReadJson(await user.Client.GetAsync("/api/notes"))).EnumerateArray().ToList();

    private static async Task<List<JsonElement>> TrashAsync(TestUser user) =>
        (await ReadJson(await user.Client.GetAsync("/api/notes/trash"))).EnumerateArray().ToList();

    private static async Task<List<(int, DateTimeOffset)>> VersionsAsync(TestUser user, params Guid[] ids)
    {
        var result = new List<(int, DateTimeOffset)>();
        foreach (var id in ids)
        {
            var note = await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"));
            result.Add((note.GetProperty("version").GetInt32(), note.GetProperty("updatedAt").GetDateTimeOffset()));
        }
        return result;
    }

    private static async Task<JsonElement> SearchAsync(TestUser user, string q, string extra = "")
    {
        var response = await user.Client.GetAsync($"/api/notes/search?q={Uri.EscapeDataString(q)}&{extra}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private static List<JsonElement> Items(JsonElement page) => page.GetProperty("items").EnumerateArray().ToList();

    private static List<Guid> Ids(JsonElement page) => Items(page).Select(i => i.GetProperty("id").GetGuid()).ToList();

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static string[] Errors(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateArray().Select(e => e.GetString()!).ToArray();

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
