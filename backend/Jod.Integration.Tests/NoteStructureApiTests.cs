using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Jod.Domain.Enums;
using Jod.Service.Data;
using Microsoft.Extensions.DependencyInjection;

namespace Jod.Integration.Tests;

public class NoteStructureApiTests : IClassFixture<JodWebFactory>
{
    private const string EmptyContent = "{\"schemaVersion\":1,\"blocks\":[]}";
    private const string NotFoundMessage = "ไม่พบโน้ตนี้";
    private const string LoopMessage = "ย้ายเข้าตัวเองหรือลูกหลานของตัวเองไม่ได้";
    private const string TooDeepMessage = "โน้ตย่อยซ้อนลึกเกินไป";

    private readonly JodWebFactory _factory;

    public NoteStructureApiTests(JodWebFactory factory) => _factory = factory;

    [Fact]
    public async Task Move_ToRoot_ReturnsTheListItemAndTheListShowsIt()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);

        // Act
        var response = await MoveAsync(user, note, "root");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var item = await ReadJson(response);
        Assert.Equal(["id", "title", "updatedAt", "placement", "parentId", "position"], item.EnumerateObject().Select(p => p.Name));
        Assert.Equal("root", item.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("parentId").ValueKind);
        Assert.Equal(0, item.GetProperty("position").GetInt32());
        Assert.Equal("root", (await ListItemAsync(user, note)).GetProperty("placement").GetString());
    }

    [Fact]
    public async Task Move_RootNotes_AreAppendedLast_AndBeforeIdInsertsAndRenumbers()
    {
        // Arrange
        var user = await SignInAsync();
        var (a, b, c) = (await CreateAsync(user), await CreateAsync(user), await CreateAsync(user));
        await MoveAsync(user, a, "root");
        await MoveAsync(user, b, "root");

        // Act
        await MoveAsync(user, c, "root", beforeId: a);

        // Assert
        Assert.Equal([c, a, b], await OrderOfAsync(user, n => n.GetProperty("placement").GetString() == "root"));
        Assert.Equal([0, 1, 2], await PositionsAsync(user, [c, a, b]));
    }

    [Fact]
    public async Task Move_ToChild_IsAppendedLast_AndBeforeIdInsertsBetween()
    {
        // Arrange
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var (a, b, c) = (await CreateAsync(user, parent), await CreateAsync(user, parent), await CreateAsync(user));

        // Act
        var appended = await ReadJson(await MoveAsync(user, c, "child", parent));
        await MoveAsync(user, c, "child", parent, beforeId: b);

        // Assert
        Assert.Equal("child", appended.GetProperty("placement").GetString());
        Assert.Equal(parent, appended.GetProperty("parentId").GetGuid());
        Assert.Equal(2, appended.GetProperty("position").GetInt32());
        Assert.Equal([a, c, b], await OrderOfAsync(user, n => n.TryGetProperty("parentId", out var p) && p.ValueKind != JsonValueKind.Null && p.GetGuid() == parent));
        Assert.Equal([0, 1, 2], await PositionsAsync(user, [a, c, b]));
    }

    [Fact]
    public async Task Move_ToUnplaced_ClearsTheParentAndPosition()
    {
        // Arrange
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var child = await CreateAsync(user, parent);
        await CreateAsync(user, parent);

        // Act
        var item = await ReadJson(await MoveAsync(user, child, "unplaced"));

        // Assert
        Assert.Equal("unplaced", item.GetProperty("placement").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("parentId").ValueKind);
        Assert.Equal(0, item.GetProperty("position").GetInt32());
    }

    [Fact]
    public async Task Move_ABranch_KeepsItsChildrenAttached()
    {
        // Arrange
        var user = await SignInAsync();
        var branch = await CreateAsync(user);
        var child = await CreateAsync(user, branch);
        var grandchild = await CreateAsync(user, child);
        var target = await CreateAsync(user);

        // Act
        await MoveAsync(user, branch, "child", target);

        // Assert
        Assert.Equal(target, (await ListItemAsync(user, branch)).GetProperty("parentId").GetGuid());
        Assert.Equal(branch, (await ListItemAsync(user, child)).GetProperty("parentId").GetGuid());
        Assert.Equal(child, (await ListItemAsync(user, grandchild)).GetProperty("parentId").GetGuid());
    }

    [Fact]
    public async Task Move_IntoItselfItsChildOrItsGrandchild_Is400WithTheLoopMessage_AndChangesNothing()
    {
        // Arrange
        var user = await SignInAsync();
        var top = await CreateAsync(user);
        var child = await CreateAsync(user, top);
        var grandchild = await CreateAsync(user, child);

        // Act
        var responses = new[]
        {
            await MoveAsync(user, top, "child", top),
            await MoveAsync(user, top, "child", child),
            await MoveAsync(user, top, "child", grandchild),
        };

        // Assert
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal([LoopMessage], Errors(await ReadJson(response)));
        }
        Assert.Equal("unplaced", (await ListItemAsync(user, top)).GetProperty("placement").GetString());
    }

    [Fact]
    public async Task Move_WithAForeignOrMissingParentOrNote_IsTheSame404()
    {
        // Arrange
        var user = await SignInAsync();
        var other = await SignInAsync();
        var mine = await CreateAsync(user);
        var theirs = await CreateAsync(other);

        // Act
        var foreignParent = await MoveAsync(user, mine, "child", theirs);
        var missingParent = await MoveAsync(user, mine, "child", Guid.NewGuid());
        var foreignNote = await MoveAsync(user, theirs, "root");
        var missingNote = await MoveAsync(user, Guid.NewGuid(), "root");

        // Assert
        foreach (var response in new[] { foreignParent, missingParent, foreignNote, missingNote })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal([NotFoundMessage], Errors(await ReadJson(response)));
        }
        Assert.Equal("unplaced", (await ListItemAsync(other, theirs)).GetProperty("placement").GetString());
    }

    [Fact]
    public async Task Move_WithABeforeIdThatIsNotASibling_Is400()
    {
        // Arrange
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var elsewhere = await CreateAsync(user);
        var note = await CreateAsync(user);
        await MoveAsync(user, elsewhere, "root");

        // Act
        var notASibling = await MoveAsync(user, note, "child", parent, beforeId: elsewhere);
        var itself = await MoveAsync(user, note, "root", beforeId: note);
        var missing = await MoveAsync(user, note, "root", beforeId: Guid.NewGuid());

        // Assert
        Assert.All(new[] { notASibling, itself, missing }, r => Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode));
        Assert.Equal("unplaced", (await ListItemAsync(user, note)).GetProperty("placement").GetString());
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"placement\":\"child\"}")]
    [InlineData("{\"placement\":\"root\",\"parentId\":\"00000000-0000-0000-0000-000000000001\"}")]
    [InlineData("{\"placement\":\"unplaced\",\"parentId\":\"00000000-0000-0000-0000-000000000001\"}")]
    [InlineData("{\"placement\":\"unplaced\",\"beforeId\":\"00000000-0000-0000-0000-000000000001\"}")]
    [InlineData("{\"placement\":\"sideways\"}")]
    public async Task Move_WithAnInvalidCombination_Is400(string body)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{note}/placement", Json(body));

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Move_ByAnAnonymousCaller_Is401()
    {
        var response = await _factory.CreateClient().PutAsync($"/api/notes/{Guid.NewGuid()}/placement", Json("{\"placement\":\"root\"}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Move_ToTheSamePlace_Is200()
    {
        // Arrange
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var note = await CreateAsync(user, parent);

        // Act
        var response = await MoveAsync(user, note, "child", parent);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, (await ReadJson(response)).GetProperty("position").GetInt32());
    }

    [Fact]
    public async Task Move_ByDepth_RejectsOverTheLimitAndAcceptsExactlyAtIt()
    {
        // Arrange: a chain c0..c198 (ci has i ancestors), and a branch b0 -> b1 (b1 is one level below b0)
        var user = await SignInAsync();
        var chain = await BuildChainAsync(user, 199);
        var branch = await CreateAsync(user);
        await CreateAsync(user, branch);
        var single = await CreateAsync(user);

        // Act: under c198 the branch root gets 199 ancestors and its child 200 (ok); a branch under a note with 200 ancestors reaches 201 (too deep), a lone note reaches exactly 200
        var atLimit = await MoveAsync(user, branch, "child", chain[198]);
        var singleAtLimit = await MoveAsync(user, single, "child", chain[198]);
        var deeper = await CreateAsync(user);
        await MoveAsync(user, deeper, "child", chain[198]);
        var overLimit = await MoveAsync(user, branch, "child", deeper);
        var singleOver = await MoveAsync(user, single, "child", deeper);

        // Assert
        Assert.Equal(HttpStatusCode.OK, atLimit.StatusCode);
        Assert.Equal(HttpStatusCode.OK, singleAtLimit.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, overLimit.StatusCode);
        Assert.Equal([TooDeepMessage], Errors(await ReadJson(overLimit)));
        Assert.Equal(HttpStatusCode.OK, singleOver.StatusCode); // 200 ancestors exactly
    }

    [Fact]
    public async Task Move_DoesNotChangeVersionOrUpdatedAt_AndASaveAfterwardsKeepsThePlacement()
    {
        // Arrange
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var note = await CreateAsync(user);
        var before = await ReadJson(await user.Client.GetAsync($"/api/notes/{note}"));

        // Act
        await MoveAsync(user, note, "child", parent);
        var after = await ReadJson(await user.Client.GetAsync($"/api/notes/{note}"));
        var saved = await user.Client.PutAsync($"/api/notes/{note}", Json(Body("renamed", before.GetProperty("version").GetInt32())));
        var stale = await user.Client.PutAsync($"/api/notes/{note}", Json(Body("late", 1)));

        // Assert
        Assert.Equal(before.GetProperty("version").GetInt32(), after.GetProperty("version").GetInt32());
        Assert.Equal(before.GetProperty("updatedAt").GetDateTimeOffset(), after.GetProperty("updatedAt").GetDateTimeOffset());
        Assert.Equal(before.GetProperty("title").GetString(), after.GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var savedNote = await ReadJson(saved);
        Assert.Equal("child", savedNote.GetProperty("placement").GetString());
        Assert.Equal(parent, savedNote.GetProperty("parentId").GetGuid());
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(parent, (await ListItemAsync(user, note)).GetProperty("parentId").GetGuid());
    }

    [Fact]
    public async Task Move_TwoOppositeMovesAtTheSameMoment_NeverLeaveALoop()
    {
        // Arrange
        var user = await SignInAsync();

        // Act + Assert: many rounds with fresh notes, A under B and B under A fired together
        for (var round = 0; round < 20; round++)
        {
            var (a, b) = (await CreateAsync(user), await CreateAsync(user));
            var results = await Task.WhenAll(MoveAsync(user, a, "child", b), MoveAsync(user, b, "child", a));

            var parents = (await ListAsync(user)).ToDictionary(n => n.GetProperty("id").GetGuid(), n => n.GetProperty("parentId"));
            Assert.False(parents[a].ValueKind != JsonValueKind.Null && parents[b].ValueKind != JsonValueKind.Null, $"loop in round {round}");
            Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
            Assert.Single(results, r => r.StatusCode == HttpStatusCode.BadRequest);
        }
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

    private static Task<HttpResponseMessage> MoveAsync(TestUser user, Guid id, string placement, Guid? parentId = null, Guid? beforeId = null)
    {
        var body = $"{{\"placement\":\"{placement}\""
            + (parentId is null ? "" : $",\"parentId\":\"{parentId}\"")
            + (beforeId is null ? "" : $",\"beforeId\":\"{beforeId}\"") + "}";
        return user.Client.PutAsync($"/api/notes/{id}/placement", Json(body));
    }

    private static async Task<List<JsonElement>> ListAsync(TestUser user) =>
        (await ReadJson(await user.Client.GetAsync("/api/notes"))).EnumerateArray().ToList();

    private static async Task<JsonElement> ListItemAsync(TestUser user, Guid id) =>
        (await ListAsync(user)).Single(n => n.GetProperty("id").GetGuid() == id);

    // Note: sibling order as the client sorts it
    private static async Task<List<Guid>> OrderOfAsync(TestUser user, Func<JsonElement, bool> filter) =>
        (await ListAsync(user)).Where(filter).OrderBy(n => n.GetProperty("position").GetInt32()).Select(n => n.GetProperty("id").GetGuid()).ToList();

    private static async Task<List<int>> PositionsAsync(TestUser user, Guid[] ids)
    {
        var list = await ListAsync(user);
        return ids.Select(id => list.Single(n => n.GetProperty("id").GetGuid() == id).GetProperty("position").GetInt32()).ToList();
    }

    private async Task<List<Guid>> BuildChainAsync(TestUser user, int length)
    {
        var ids = new List<Guid>();
        await using var scope = _factory.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<JodDbContext>();
        for (var i = 0; i < length; i++)
        {
            var id = Guid.NewGuid();
            context.Notes.Add(new Note
            {
                Id = id,
                OwnerId = user.UserId,
                Title = $"c{i}",
                Context = "",
                Content = EmptyContent,
                Version = 1,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                Placement = i == 0 ? NotePlacement.Root : NotePlacement.Child,
                ParentId = i == 0 ? null : ids[i - 1],
            });
            ids.Add(id);
            await context.SaveChangesAsync();
        }
        return ids;
    }

    private static string Body(string title, int baseVersion) =>
        $"{{\"title\":{JsonSerializer.Serialize(title)},\"context\":\"\",\"content\":{EmptyContent},\"baseVersion\":{baseVersion}}}";

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static string[] Errors(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateArray().Select(e => e.GetString()!).ToArray();

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
