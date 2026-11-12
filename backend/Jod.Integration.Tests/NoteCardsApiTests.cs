using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Jod.Service.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jod.Integration.Tests;

public class NoteCardsApiTests : IClassFixture<JodWebFactory>
{
    private readonly JodWebFactory _factory;

    public NoteCardsApiTests(JodWebFactory factory) => _factory = factory;

    // ---- the forward card table ----

    [Fact]
    public async Task Create_WithReferenceBlocks_StoresTheDistinctTargets_IncludingNestedOnes()
    {
        var user = await SignInAsync();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var content = Content(Ref(a), Toggle(Ref(b), Ref(a)));

        var response = await user.Client.PostAsync("/api/notes", Json($"{{\"content\":{content}}}"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var source = (await ReadJson(response)).GetProperty("id").GetGuid();
        Assert.Equal(new[] { a, b }.OrderBy(x => x), await TargetsAsync(source));
    }

    [Fact]
    public async Task Save_AddsChangesAndRemovesCardRows()
    {
        var user = await SignInAsync();
        var source = await CreateAsync(user);
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        await SaveAsync(user, source, 1, Content(Ref(a)));
        Assert.Equal([a], await TargetsAsync(source));

        await SaveAsync(user, source, 2, Content(Ref(b)));
        Assert.Equal([b], await TargetsAsync(source));

        await SaveAsync(user, source, 3, Content(Toggle(Ref(a), Ref(b))));
        Assert.Equal(new[] { a, b }.OrderBy(x => x), await TargetsAsync(source));

        await SaveAsync(user, source, 4, Content());
        Assert.Empty(await TargetsAsync(source));
    }

    [Fact]
    public async Task Save_WithAStaleVersion_LeavesTheCardRowsAlone()
    {
        var user = await SignInAsync();
        var source = await CreateAsync(user);
        var a = Guid.NewGuid();
        await SaveAsync(user, source, 1, Content(Ref(a)));

        var response = await user.Client.PutAsync($"/api/notes/{source}", SaveBody(1, Content(Ref(Guid.NewGuid()))));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal([a], await TargetsAsync(source));
    }

    [Fact]
    public async Task Save_AReferenceToANoteThatDoesNotExist_IsAccepted()
    {
        var user = await SignInAsync();
        var source = await CreateAsync(user);

        var response = await user.Client.PutAsync($"/api/notes/{source}", SaveBody(1, Content(Ref(Guid.NewGuid()))));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ReferenceBlocksAddNothingToTheSearchText()
    {
        var user = await SignInAsync();
        var target = Guid.NewGuid();
        var source = await CreateAsync(user, Content(Ref(target)));

        await using var scope = _factory.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<JodDbContext>();
        Assert.Equal("", await context.Notes.Where(n => n.Id == source).Select(n => n.SearchText).SingleAsync());
    }

    [Theory]
    [InlineData("\"noteId\":\"nope\"")]
    [InlineData("")]
    [InlineData("\"noteId\":\"00000000-0000-0000-0000-000000000001\",\"children\":[]")]
    [InlineData("\"noteId\":\"00000000-0000-0000-0000-000000000001\",\"text\":\"x\"")]
    public async Task InvalidReferenceBlocks_Are400_OnCreateAndSave(string properties)
    {
        var user = await SignInAsync();
        var source = await CreateAsync(user);
        var content = Content($"{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"reference\"{(properties.Length == 0 ? "" : "," + properties)}}}");

        var create = await user.Client.PostAsync("/api/notes", Json($"{{\"content\":{content}}}"));
        var save = await user.Client.PutAsync($"/api/notes/{source}", SaveBody(1, content));

        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, save.StatusCode);
        Assert.Empty(await TargetsAsync(source));
    }

    [Fact]
    public async Task DeletingTheSourcePermanently_RemovesItsCardRows_AndTheTargetStaysDeletable()
    {
        var user = await SignInAsync();
        var target = await CreateAsync(user);
        var source = await CreateAsync(user, Content(Ref(target)));
        Assert.Equal([target], await TargetsAsync(source));

        (await user.Client.DeleteAsync($"/api/notes/{target}")).EnsureSuccessStatusCode();
        var targetGone = await user.Client.DeleteAsync($"/api/notes/{target}/permanent");
        (await user.Client.DeleteAsync($"/api/notes/{source}")).EnsureSuccessStatusCode();
        var sourceGone = await user.Client.DeleteAsync($"/api/notes/{source}/permanent");

        Assert.Equal(HttpStatusCode.OK, targetGone.StatusCode);
        Assert.Equal(HttpStatusCode.OK, sourceGone.StatusCode);
        Assert.Empty(await TargetsAsync(source));
    }

    // ---- POST /api/notes/cards ----

    [Fact]
    public async Task Cards_AliveNotes_ShowTitleParentTitleAndPlacement()
    {
        var user = await SignInAsync();
        var unplaced = await CreateAsync(user, title: "Loose");
        var root = await CreateAsync(user, title: "Top");
        await MoveAsync(user, root, "{\"placement\":\"root\"}");
        var child = await CreateAsync(user, title: "Kid", parentId: root);

        var items = await CardsAsync(user, unplaced, root, child);

        Assert.Equal(["alive", "alive", "alive"], items.Select(i => i.GetProperty("status").GetString()));
        Assert.Equal(["noteId", "status", "title", "parentTitle", "placement"], items[0].EnumerateObject().Select(p => p.Name));
        AssertCard(items[0], unplaced, "Loose", null, "unplaced");
        AssertCard(items[1], root, "Top", null, "root");
        AssertCard(items[2], child, "Kid", "Top", "child");
    }

    [Fact]
    public async Task Cards_ATrashedNote_IsTrashed_AndUsesItsOriginalParentTitle()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user, title: "Parent");
        var child = await CreateAsync(user, title: "Kid", parentId: parent);
        var loose = await CreateAsync(user, title: "Loose");
        (await user.Client.DeleteAsync($"/api/notes/{child}?scope=single")).EnsureSuccessStatusCode();
        (await user.Client.DeleteAsync($"/api/notes/{loose}")).EnsureSuccessStatusCode();

        var items = await CardsAsync(user, child, loose);

        AssertCard(items[0], child, "Kid", "Parent", "child");
        Assert.Equal("trashed", items[0].GetProperty("status").GetString());
        AssertCard(items[1], loose, "Loose", null, "unplaced");
        Assert.Equal("trashed", items[1].GetProperty("status").GetString());
    }

    [Fact]
    public async Task Cards_ATrashedNoteWhoseParentIsGone_HasNoParentTitle()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user, title: "Parent");
        var child = await CreateAsync(user, title: "Kid", parentId: parent);
        (await user.Client.DeleteAsync($"/api/notes/{child}")).EnsureSuccessStatusCode();
        (await user.Client.DeleteAsync($"/api/notes/{parent}?scope=single")).EnsureSuccessStatusCode();
        (await user.Client.DeleteAsync($"/api/notes/{parent}/permanent")).EnsureSuccessStatusCode();

        var items = await CardsAsync(user, child);

        Assert.Equal("trashed", items[0].GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, items[0].GetProperty("parentTitle").ValueKind);
    }

    [Fact]
    public async Task Cards_AnotherUsersNoteAndAMissingNote_LookTheSame()
    {
        var user = await SignInAsync();
        var other = await SignInAsync();
        var foreign = await CreateAsync(other, title: "secret title");
        var missing = Guid.NewGuid();

        var items = await CardsAsync(user, foreign, missing);

        Assert.Equal(["missing", "missing"], items.Select(i => i.GetProperty("status").GetString()));
        Assert.Equal(["noteId", "status", "title", "parentTitle", "placement"], items[0].EnumerateObject().Select(p => p.Name));
        foreach (var item in items)
        {
            Assert.Equal(JsonValueKind.Null, item.GetProperty("title").ValueKind);
            Assert.Equal(JsonValueKind.Null, item.GetProperty("parentTitle").ValueKind);
            Assert.Equal(JsonValueKind.Null, item.GetProperty("placement").ValueKind);
        }
        Assert.Equal(
            items[1].GetRawText().Replace(missing.ToString(), "X"),
            items[0].GetRawText().Replace(foreign.ToString(), "X"));
    }

    [Fact]
    public async Task Cards_DuplicateIds_GiveOneItemEachInFirstAppearanceOrder()
    {
        var user = await SignInAsync();
        var a = await CreateAsync(user, title: "A");
        var b = await CreateAsync(user, title: "B");

        var items = await CardsAsync(user, b, a, b, a);

        Assert.Equal([b, a], items.Select(i => i.GetProperty("noteId").GetGuid()));
    }

    [Fact]
    public async Task Cards_100IdsAreAllowed_AndAnEmptyListOrMoreThan100Is400()
    {
        var user = await SignInAsync();
        var ids = Enumerable.Range(0, 101).Select(_ => Guid.NewGuid()).ToList();

        var ok = await user.Client.PostAsync("/api/notes/cards", Json(JsonSerializer.Serialize(new { noteIds = ids.Take(100) })));
        var tooMany = await user.Client.PostAsync("/api/notes/cards", Json(JsonSerializer.Serialize(new { noteIds = ids })));
        var empty = await user.Client.PostAsync("/api/notes/cards", Json("{\"noteIds\":[]}"));
        var none = await user.Client.PostAsync("/api/notes/cards", Json("{}"));

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(100, (await ReadJson(ok)).GetProperty("items").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Single((await ReadJson(tooMany)).GetProperty("errors").EnumerateArray());
    }

    [Fact]
    public async Task Cards_ByAnAnonymousCaller_Is401()
    {
        var response = await _factory.CreateClient().PostAsync("/api/notes/cards", Json("{\"noteIds\":[]}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task NeverPutsNoteTitlesInTheLogs()
    {
        var marker = "secret-" + Guid.NewGuid().ToString("N");
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: marker);

        await CardsAsync(user, note, Guid.NewGuid());
        await user.Client.PostAsync("/api/notes/cards", Json("{\"noteIds\":[]}"));

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

    private static string Ref(Guid target) => $"{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"reference\",\"noteId\":\"{target}\"}}";

    private static string Toggle(params string[] children) =>
        $"{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"toggle\",\"text\":\"t\",\"children\":[{string.Join(",", children)}]}}";

    private static string Content(params string[] blocks) => $"{{\"schemaVersion\":1,\"blocks\":[{string.Join(",", blocks)}]}}";

    private static StringContent SaveBody(int baseVersion, string content) =>
        Json($"{{\"title\":\"Untitled\",\"context\":\"\",\"content\":{content},\"baseVersion\":{baseVersion}}}");

    private static async Task<Guid> CreateAsync(TestUser user, string? content = null, string? title = null, Guid? parentId = null)
    {
        var body = new Dictionary<string, object?> { ["title"] = title, ["parentId"] = parentId };
        if (content is not null)
        {
            body["content"] = JsonDocument.Parse(content).RootElement;
        }
        var response = await user.Client.PostAsync("/api/notes", Json(JsonSerializer.Serialize(body)));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private static async Task SaveAsync(TestUser user, Guid id, int baseVersion, string content) =>
        Assert.Equal(HttpStatusCode.OK, (await user.Client.PutAsync($"/api/notes/{id}", SaveBody(baseVersion, content))).StatusCode);

    private static async Task MoveAsync(TestUser user, Guid id, string body) =>
        (await user.Client.PutAsync($"/api/notes/{id}/placement", Json(body))).EnsureSuccessStatusCode();

    private async Task<List<Guid>> TargetsAsync(Guid source)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<JodDbContext>();
        return await context.NoteCardReferences.Where(r => r.SourceNoteId == source)
            .Select(r => r.TargetNoteId).OrderBy(id => id).ToListAsync();
    }

    private static async Task<List<JsonElement>> CardsAsync(TestUser user, params Guid[] ids)
    {
        var response = await user.Client.PostAsync("/api/notes/cards", Json(JsonSerializer.Serialize(new { noteIds = ids })));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJson(response)).GetProperty("items").EnumerateArray().ToList();
    }

    private static void AssertCard(JsonElement item, Guid id, string title, string? parentTitle, string placement)
    {
        Assert.Equal(id, item.GetProperty("noteId").GetGuid());
        Assert.Equal(title, item.GetProperty("title").GetString());
        Assert.Equal(parentTitle, item.GetProperty("parentTitle").GetString());
        Assert.Equal(placement, item.GetProperty("placement").GetString());
    }

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
