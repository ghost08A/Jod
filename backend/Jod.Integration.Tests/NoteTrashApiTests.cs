using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Jod.Integration.Tests;

public class NoteTrashApiTests : IClassFixture<JodWebFactory>
{
    private const string EmptyContent = "{\"schemaVersion\":1,\"blocks\":[]}";
    private const string NotFoundMessage = "ไม่พบโน้ตนี้";

    private readonly JodWebFactory _factory;

    public NoteTrashApiTests(JodWebFactory factory) => _factory = factory;

    [Fact]
    public async Task DeleteBranch_TakesTheNoteAndAllItsDescendantsToTheTrashInOneBatch()
    {
        // Arrange: top (root) -> a -> a1, and top -> b; plus an unrelated note
        var user = await SignInAsync();
        var top = await CreateAsync(user);
        await MoveAsync(user, top, "root");
        var a = await CreateAsync(user, top);
        var a1 = await CreateAsync(user, a);
        var b = await CreateAsync(user, top);
        var other = await CreateAsync(user);

        // Act
        var response = await DeleteAsync(user, top, "branch");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(4, (await ReadJson(response)).GetProperty("deletedCount").GetInt32());
        Assert.Equal([other], (await ListAsync(user)).Select(n => n.GetProperty("id").GetGuid()).ToList());
        var trash = await TrashAsync(user);
        Assert.Equal(4, trash.Count);
        Assert.Single(trash.Select(n => n.GetProperty("trashBatchId").GetGuid()).Distinct());
        Assert.Equal(["id", "title", "deletedAt", "trashBatchId", "placement", "parentId", "position"], trash[0].EnumerateObject().Select(p => p.Name));
        var byId = trash.ToDictionary(n => n.GetProperty("id").GetGuid());
        Assert.Equal("root", byId[top].GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, byId[top].GetProperty("parentId").ValueKind);
        Assert.Equal(top, byId[a].GetProperty("parentId").GetGuid());
        Assert.Equal("child", byId[a].GetProperty("placement").GetString());
        Assert.Equal(0, byId[a].GetProperty("position").GetInt32());
        Assert.Equal(a, byId[a1].GetProperty("parentId").GetGuid());
        Assert.Equal(1, byId[b].GetProperty("position").GetInt32());
    }

    [Fact]
    public async Task Delete_WithoutScope_DeletesTheWholeBranch()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var child = await CreateAsync(user, parent);

        var response = await user.Client.DeleteAsync($"/api/notes/{parent}");

        Assert.Equal(2, (await ReadJson(response)).GetProperty("deletedCount").GetInt32());
        Assert.Empty(await ListAsync(user));
        Assert.Contains(await TrashAsync(user), n => n.GetProperty("id").GetGuid() == child);
    }

    [Theory]
    [InlineData("all")]
    [InlineData("Branch")]
    public async Task Delete_WithABadScope_Is400_AndDeletesNothing(string scope)
    {
        var user = await SignInAsync();
        var note = await CreateAsync(user);

        var response = await user.Client.DeleteAsync($"/api/notes/{note}?scope={scope}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Single(await ListAsync(user));
    }

    [Fact]
    public async Task DeleteSingle_OfAChild_LiftsItsChildrenIntoItsPlaceInOrder_AndRenumbers()
    {
        // Arrange: parent -> [s1, victim(c1, c2), s2]
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var s1 = await CreateAsync(user, parent);
        var victim = await CreateAsync(user, parent);
        var s2 = await CreateAsync(user, parent);
        var (c1, c2) = (await CreateAsync(user, victim), await CreateAsync(user, victim));
        var grandchild = await CreateAsync(user, c1);

        // Act
        var response = await DeleteAsync(user, victim, "single");

        // Assert
        Assert.Equal(1, (await ReadJson(response)).GetProperty("deletedCount").GetInt32());
        var list = await ListAsync(user);
        var siblings = list.Where(n => n.GetProperty("parentId").ValueKind != JsonValueKind.Null && n.GetProperty("parentId").GetGuid() == parent)
            .OrderBy(n => n.GetProperty("position").GetInt32()).ToList();
        Assert.Equal([s1, c1, c2, s2], siblings.Select(n => n.GetProperty("id").GetGuid()).ToList());
        Assert.Equal([0, 1, 2, 3], siblings.Select(n => n.GetProperty("position").GetInt32()).ToList());
        Assert.All(siblings, n => Assert.Equal("child", n.GetProperty("placement").GetString()));
        Assert.Equal(c1, list.Single(n => n.GetProperty("id").GetGuid() == grandchild).GetProperty("parentId").GetGuid());
        var trash = await TrashAsync(user);
        var item = Assert.Single(trash);
        Assert.Equal(victim, item.GetProperty("id").GetGuid());
        Assert.Equal(parent, item.GetProperty("parentId").GetGuid());
        Assert.Equal("child", item.GetProperty("placement").GetString());
        Assert.Equal(1, item.GetProperty("position").GetInt32());
    }

    [Fact]
    public async Task DeleteSingle_OfARoot_MakesItsChildrenRoots_InItsPlace()
    {
        // Arrange: roots [r1, victim(c1, c2), r2]
        var user = await SignInAsync();
        var r1 = await CreateAsync(user);
        var victim = await CreateAsync(user);
        var r2 = await CreateAsync(user);
        foreach (var id in new[] { r1, victim, r2 })
        {
            await MoveAsync(user, id, "root");
        }
        var (c1, c2) = (await CreateAsync(user, victim), await CreateAsync(user, victim));

        // Act
        await DeleteAsync(user, victim, "single");

        // Assert
        var roots = (await ListAsync(user)).Where(n => n.GetProperty("placement").GetString() == "root")
            .OrderBy(n => n.GetProperty("position").GetInt32()).ToList();
        Assert.Equal([r1, c1, c2, r2], roots.Select(n => n.GetProperty("id").GetGuid()).ToList());
        Assert.Equal([0, 1, 2, 3], roots.Select(n => n.GetProperty("position").GetInt32()).ToList());
        Assert.All(roots, n => Assert.Equal(JsonValueKind.Null, n.GetProperty("parentId").ValueKind));
        Assert.Equal("root", Assert.Single(await TrashAsync(user)).GetProperty("placement").GetString());
    }

    [Fact]
    public async Task DeleteSingle_OfAnUnplacedNote_MakesItsChildrenUnplaced()
    {
        // Arrange
        var user = await SignInAsync();
        var victim = await CreateAsync(user);
        var child = await CreateAsync(user, victim);
        var grandchild = await CreateAsync(user, child);

        // Act
        await DeleteAsync(user, victim, "single");

        // Assert
        var list = await ListAsync(user);
        var lifted = list.Single(n => n.GetProperty("id").GetGuid() == child);
        Assert.Equal("unplaced", lifted.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, lifted.GetProperty("parentId").ValueKind);
        Assert.Equal(0, lifted.GetProperty("position").GetInt32());
        Assert.Equal(child, list.Single(n => n.GetProperty("id").GetGuid() == grandchild).GetProperty("parentId").GetGuid());
        var item = Assert.Single(await TrashAsync(user));
        Assert.Equal("unplaced", item.GetProperty("placement").GetString());
    }

    [Fact]
    public async Task Delete_Twice_ForeignOrMissing_IsTheSame404()
    {
        // Arrange
        var user = await SignInAsync();
        var other = await SignInAsync();
        var mine = await CreateAsync(user);
        var theirs = await CreateAsync(other);
        await DeleteAsync(user, mine, "branch");

        // Act
        var again = await DeleteAsync(user, mine, "single");
        var foreign = await DeleteAsync(user, theirs, "branch");
        var missing = await DeleteAsync(user, Guid.NewGuid(), "branch");

        // Assert
        foreach (var response in new[] { again, foreign, missing })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal([NotFoundMessage], Errors(await ReadJson(response)));
        }
        Assert.Single(await ListAsync(other));
        Assert.Empty(await TrashAsync(other));
    }

    [Fact]
    public async Task Delete_ByAnAnonymousCaller_Is401()
    {
        var response = await _factory.CreateClient().DeleteAsync($"/api/notes/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ADeletedNote_IsStillReadableWithDeletedAt_ButASaveOnItIs404()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        var alive = await ReadJson(await user.Client.GetAsync($"/api/notes/{note}"));
        await DeleteAsync(user, note, "branch");

        // Act
        var read = await user.Client.GetAsync($"/api/notes/{note}");
        var save = await user.Client.PutAsync($"/api/notes/{note}", Json(Body("late", alive.GetProperty("version").GetInt32())));
        var staleSave = await user.Client.PutAsync($"/api/notes/{note}", Json(Body("late", 99)));

        // Assert
        Assert.Equal(JsonValueKind.Null, alive.GetProperty("deletedAt").ValueKind);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.NotEqual(JsonValueKind.Null, (await ReadJson(read)).GetProperty("deletedAt").ValueKind);
        foreach (var response in new[] { save, staleSave })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal([NotFoundMessage], Errors(await ReadJson(response)));
        }
        Assert.Equal("Untitled", (await ReadJson(await user.Client.GetAsync($"/api/notes/{note}"))).GetProperty("title").GetString());
    }

    [Fact]
    public async Task ADeletedNote_OfAnotherUser_IsStill404OnRead()
    {
        var user = await SignInAsync();
        var other = await SignInAsync();
        var note = await CreateAsync(user);
        await DeleteAsync(user, note, "branch");

        var response = await other.Client.GetAsync($"/api/notes/{note}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_UnderADeletedParent_Is404()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        await DeleteAsync(user, parent, "branch");

        var response = await user.Client.PostAsync("/api/notes", Json($"{{\"parentId\":\"{parent}\"}}"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await ListAsync(user));
    }

    [Fact]
    public async Task Create_NextChildPosition_IgnoresDeletedSiblings()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        await CreateAsync(user, parent);
        var gone = await CreateAsync(user, parent);
        await DeleteAsync(user, gone, "branch");

        var next = await CreateAsync(user, parent);

        Assert.Equal(1, (await ListAsync(user)).Single(n => n.GetProperty("id").GetGuid() == next).GetProperty("position").GetInt32());
    }

    [Fact]
    public async Task Move_OfADeletedNote_OrIntoADeletedParent_Is404()
    {
        // Arrange
        var user = await SignInAsync();
        var gone = await CreateAsync(user);
        var mine = await CreateAsync(user);
        await DeleteAsync(user, gone, "branch");

        // Act
        var movedDeleted = await MoveAsync(user, gone, "root");
        var intoDeleted = await MoveAsync(user, mine, "child", gone);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, movedDeleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, intoDeleted.StatusCode);
        Assert.Equal("unplaced", Assert.Single(await ListAsync(user)).GetProperty("placement").GetString());
    }

    [Fact]
    public async Task Move_IntoAParent_IgnoresDeletedSiblingsForBeforeIdAndNumbering()
    {
        // Arrange: parent -> [a, gone, b]
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var a = await CreateAsync(user, parent);
        var gone = await CreateAsync(user, parent);
        var b = await CreateAsync(user, parent);
        await DeleteAsync(user, gone, "branch");
        var mover = await CreateAsync(user);

        // Act
        var onDeleted = await MoveAsync(user, mover, "child", parent, beforeId: gone);
        var inserted = await MoveAsync(user, mover, "child", parent, beforeId: b);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, onDeleted.StatusCode);
        Assert.Equal(HttpStatusCode.OK, inserted.StatusCode);
        var kids = (await ListAsync(user)).Where(n => n.GetProperty("parentId").ValueKind != JsonValueKind.Null).OrderBy(n => n.GetProperty("position").GetInt32()).ToList();
        Assert.Equal([a, mover, b], kids.Select(n => n.GetProperty("id").GetGuid()).ToList());
        Assert.Equal([0, 1, 2], kids.Select(n => n.GetProperty("position").GetInt32()).ToList());
    }

    [Fact]
    public async Task Trash_ListsOnlyTheCallersNotes_NewestDeleteFirst_AndTheListNeverHasThem()
    {
        // Arrange
        var user = await SignInAsync();
        var other = await SignInAsync();
        var first = await CreateAsync(user);
        var second = await CreateAsync(user);
        var theirs = await CreateAsync(other);
        await DeleteAsync(user, first, "branch");
        await Task.Delay(20);
        await DeleteAsync(user, second, "branch");
        await DeleteAsync(other, theirs, "branch");

        // Act
        var mine = await TrashAsync(user);
        var yours = await TrashAsync(other);

        // Assert
        Assert.Equal([second, first], mine.Select(n => n.GetProperty("id").GetGuid()).ToList());
        Assert.Equal([theirs], yours.Select(n => n.GetProperty("id").GetGuid()).ToList());
        Assert.Empty(await ListAsync(user));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/api/notes/trash")).StatusCode);
    }

    [Fact]
    public async Task Delete_DoesNotChangeVersionOrUpdatedAtOfOtherNotes_OrOfTheDeletedOnes()
    {
        // Arrange
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var victim = await CreateAsync(user, parent);
        var child = await CreateAsync(user, victim);
        var bystander = await CreateAsync(user, parent);
        var ids = new[] { parent, victim, child, bystander };
        var before = await VersionsAsync(user, ids);

        // Act
        await DeleteAsync(user, victim, "single");

        // Assert
        Assert.Equal(before, await VersionsAsync(user, ids));
    }

    [Fact]
    public async Task Delete_AndMove_OfTheSameUser_NeverLeaveAnAliveNoteUnderADeletedParent()
    {
        // Arrange + Act + Assert: many rounds, "delete the branch" and "move a note into the branch" fired together
        var user = await SignInAsync();
        for (var round = 0; round < 20; round++)
        {
            var top = await CreateAsync(user);
            var child = await CreateAsync(user, top);
            var mover = await CreateAsync(user);

            await Task.WhenAll(DeleteAsync(user, top, "branch"), MoveAsync(user, mover, "child", child));

            var alive = (await ListAsync(user)).ToDictionary(n => n.GetProperty("id").GetGuid(), n => n.GetProperty("parentId"));
            foreach (var (id, parentId) in alive)
            {
                Assert.True(parentId.ValueKind == JsonValueKind.Null || alive.ContainsKey(parentId.GetGuid()), $"alive note under a deleted parent in round {round}");
            }
        }
    }

    [Fact]
    public async Task Delete_NeverPutsNoteContentInTheLogs()
    {
        // Arrange
        var marker = "secret-" + Guid.NewGuid().ToString("N");
        var user = await SignInAsync();
        var created = await user.Client.PostAsync("/api/notes", Json($"{{\"title\":\"{marker}\",\"context\":\"{marker}\"}}"));
        var id = (await ReadJson(created)).GetProperty("id").GetGuid();

        // Act
        await DeleteAsync(user, id, "branch");
        await DeleteAsync(user, id, "branch");
        await user.Client.GetAsync("/api/notes/trash");
        await user.Client.DeleteAsync($"/api/notes/{id}?scope=bad");

        // Assert
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

    private static async Task<Guid> CreateAsync(TestUser user, Guid? parentId = null)
    {
        var response = await user.Client.PostAsync("/api/notes", Json(parentId is null ? "{}" : $"{{\"parentId\":\"{parentId}\"}}"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private static Task<HttpResponseMessage> DeleteAsync(TestUser user, Guid id, string scope) =>
        user.Client.DeleteAsync($"/api/notes/{id}?scope={scope}");

    private static Task<HttpResponseMessage> MoveAsync(TestUser user, Guid id, string placement, Guid? parentId = null, Guid? beforeId = null)
    {
        var body = $"{{\"placement\":\"{placement}\""
            + (parentId is null ? "" : $",\"parentId\":\"{parentId}\"")
            + (beforeId is null ? "" : $",\"beforeId\":\"{beforeId}\"") + "}";
        return user.Client.PutAsync($"/api/notes/{id}/placement", Json(body));
    }

    private static async Task<List<JsonElement>> ListAsync(TestUser user) =>
        (await ReadJson(await user.Client.GetAsync("/api/notes"))).EnumerateArray().ToList();

    private static async Task<List<JsonElement>> TrashAsync(TestUser user)
    {
        var response = await user.Client.GetAsync("/api/notes/trash");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJson(response)).EnumerateArray().ToList();
    }

    // Note: version and updatedAt of each note, read one by one (a deleted note is still readable)
    private static async Task<List<(int, DateTimeOffset)>> VersionsAsync(TestUser user, Guid[] ids)
    {
        var result = new List<(int, DateTimeOffset)>();
        foreach (var id in ids)
        {
            var note = await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"));
            result.Add((note.GetProperty("version").GetInt32(), note.GetProperty("updatedAt").GetDateTimeOffset()));
        }
        return result;
    }

    private static string Body(string title, int baseVersion) =>
        $"{{\"title\":{JsonSerializer.Serialize(title)},\"context\":\"\",\"content\":{EmptyContent},\"baseVersion\":{baseVersion}}}";

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static string[] Errors(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateArray().Select(e => e.GetString()!).ToArray();

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
