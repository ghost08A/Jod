using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Jod.Service.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jod.Integration.Tests;

public class NoteSearchApiTests : IClassFixture<JodWebFactory>
{
    private readonly JodWebFactory _factory;

    public NoteSearchApiTests(JodWebFactory factory) => _factory = factory;

    [Fact]
    public async Task Search_FindsANoteByItsTitle()
    {
        var user = await SignInAsync();
        var hit = await CreateAsync(user, title: "Shopping list");
        await CreateAsync(user, title: "Other");

        var page = await SearchAsync(user, "shopping");

        Assert.Equal([hit], Ids(page));
        Assert.False(page.GetProperty("hasMore").GetBoolean());
        Assert.Equal(["id", "title", "updatedAt", "path", "snippet"], Items(page)[0].EnumerateObject().Select(p => p.Name));
    }

    [Fact]
    public async Task Search_FindsANoteByItsContent_AndTheSnippetHoldsTheMatch()
    {
        var user = await SignInAsync();
        var hit = await CreateAsync(user, text: new string('a', 300) + " needle " + new string('b', 300));
        await CreateAsync(user, text: "nothing here");

        var page = await SearchAsync(user, "needle");

        Assert.Equal([hit], Ids(page));
        var snippet = Items(page)[0].GetProperty("snippet").GetString()!;
        Assert.Contains("needle", snippet);
        Assert.InRange(snippet.Length, 100, 101);
    }

    [Fact]
    public async Task Search_ThaiSubstring_IsFoundInATitleAndInContent_WithoutWordSegmentation()
    {
        var user = await SignInAsync();
        var inTitle = await CreateAsync(user, title: "ประเทศไทย");
        var inContent = await CreateAsync(user, text: "เที่ยวประเทศไทยหน้าฝน");
        await CreateAsync(user, title: "ประเทศญี่ปุ่น", text: "เที่ยวญี่ปุ่น");

        var page = await SearchAsync(user, "ไทย");

        Assert.Equal([inTitle, inContent], Ids(page));
        Assert.Contains("ไทย", Items(page)[1].GetProperty("snippet").GetString());
    }

    [Fact]
    public async Task Search_IsCaseInsensitive()
    {
        var user = await SignInAsync();
        var inTitle = await CreateAsync(user, title: "Quarterly REPORT");
        var inContent = await CreateAsync(user, text: "see the Report");

        var page = await SearchAsync(user, "rEpOrT");

        Assert.Equal([inTitle, inContent], Ids(page));
    }

    [Theory]
    [InlineData("50%", "sale 50% off", "sale 500 off")]
    [InlineData("a_b", "x a_b y", "x aXb y")]
    [InlineData("a\\b", "x a\\b y", "x ab y")]
    [InlineData("%", "100%", "no percent")]
    public async Task Search_TreatsPercentUnderscoreAndBackslashAsPlainText(string query, string matching, string other)
    {
        var user = await SignInAsync();
        var hit = await CreateAsync(user, text: matching);
        await CreateAsync(user, text: other);

        var page = await SearchAsync(user, query);

        Assert.Equal([hit], Ids(page));
    }

    [Fact]
    public async Task Search_WithNothingFound_GivesAnEmptyList()
    {
        var user = await SignInAsync();
        await CreateAsync(user, title: "something");

        var page = await SearchAsync(user, "absent");

        Assert.Empty(Items(page));
        Assert.False(page.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task Search_DoesNotLookInContext()
    {
        // Arrange: one note made with a context, one saved with a context
        var user = await SignInAsync();
        await CreateAsync(user, context: "contextword");
        var saved = await CreateAsync(user, title: "plain");
        var save = await user.Client.PutAsync($"/api/notes/{saved}", Json($"{{\"title\":\"plain\",\"context\":\"contextword\",\"content\":{ContentOf("x")},\"baseVersion\":1}}"));
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        // Act + Assert
        Assert.Empty(Items(await SearchAsync(user, "contextword")));
    }

    [Fact]
    public async Task Search_FindsUnplacedRootAndNestedNotes_AndGivesThePathTopDown()
    {
        // Arrange: top (root) -> mid -> leaf, and an unplaced note
        var user = await SignInAsync();
        var top = await CreateAsync(user, title: "Top");
        await MoveToRootAsync(user, top);
        var mid = await CreateAsync(user, title: "Mid", parentId: top);
        var leaf = await CreateAsync(user, title: "Leaf", text: "findme", parentId: mid);
        var unplaced = await CreateAsync(user, text: "findme too");

        // Act
        var page = await SearchAsync(user, "findme");
        var topPage = await SearchAsync(user, "top");

        // Assert
        var byId = Items(page).ToDictionary(i => i.GetProperty("id").GetGuid());
        Assert.Equal(2, byId.Count);
        Assert.Equal(["Top", "Mid"], byId[leaf].GetProperty("path").EnumerateArray().Select(p => p.GetProperty("title").GetString()).ToList());
        Assert.Equal([top, mid], byId[leaf].GetProperty("path").EnumerateArray().Select(p => p.GetProperty("id").GetGuid()).ToList());
        Assert.Empty(byId[unplaced].GetProperty("path").EnumerateArray());
        Assert.Equal([top], Ids(topPage));
        Assert.Empty(Items(topPage)[0].GetProperty("path").EnumerateArray());
    }

    [Fact]
    public async Task Search_NeverListsADeletedNote_ButAnAliveChildOfADeletedNoteStaysFound()
    {
        var user = await SignInAsync();
        var gone = await CreateAsync(user, title: "gonetitle", text: "gonetext");
        var parent = await CreateAsync(user, title: "parent");
        var child = await CreateAsync(user, text: "gonetext", parentId: parent);
        await user.Client.DeleteAsync($"/api/notes/{gone}");
        await user.Client.DeleteAsync($"/api/notes/{parent}?scope=single");

        var page = await SearchAsync(user, "gone");

        Assert.Equal([child], Ids(page));
        Assert.Empty(Items(await SearchAsync(user, "gonetitle")));
    }

    [Fact]
    public async Task Search_NeverReturnsAnotherUsersNotes()
    {
        var user = await SignInAsync();
        var other = await SignInAsync();
        await CreateAsync(other, title: "sharedword", text: "sharedword");
        var mine = await CreateAsync(user, title: "sharedword");

        Assert.Equal([mine], Ids(await SearchAsync(user, "sharedword")));
        Assert.Empty(Items(await SearchAsync(await SignInAsync(), "sharedword")));
    }

    [Fact]
    public async Task Search_PutsTitleMatchesFirst_ThenNewestFirst_AndTiesById()
    {
        // Arrange: content-only c1 (oldest), c2; title t1, t2 (newest); and two notes with the very same UpdatedAt
        var user = await SignInAsync();
        var c1 = await CreateAsync(user, text: "word");
        var t1 = await CreateAsync(user, title: "word one");
        var c2 = await CreateAsync(user, text: "word");
        var t2 = await CreateAsync(user, title: "word two", text: "word");
        var tieA = await CreateAsync(user, title: "word tie a");
        var tieB = await CreateAsync(user, title: "word tie b");
        await SetUpdatedAtAsync(DateTimeOffset.UtcNow.AddYears(1), tieA, tieB);

        // Act
        var order = Ids(await SearchAsync(user, "word"));

        // Assert
        Assert.Equal([.. new[] { tieA, tieB }.OrderBy(id => id), t2, t1, c2, c1], order);
    }

    [Fact]
    public async Task Search_Pages50AtATime_WithHasMore_AndNoDuplicates()
    {
        // Arrange: 120 matches
        var user = await SignInAsync();
        var all = new List<Guid>();
        for (var i = 0; i < 120; i++)
        {
            all.Add(await CreateAsync(user, text: "pagedword"));
        }

        // Act
        var first = await SearchAsync(user, "pagedword");
        var second = await SearchAsync(user, "pagedword", 50);
        var third = await SearchAsync(user, "pagedword", 100);
        var beyond = await SearchAsync(user, "pagedword", 120);

        // Assert
        Assert.Equal(50, Items(first).Count);
        Assert.True(first.GetProperty("hasMore").GetBoolean());
        Assert.Equal(50, Items(second).Count);
        Assert.True(second.GetProperty("hasMore").GetBoolean());
        Assert.Equal(20, Items(third).Count);
        Assert.False(third.GetProperty("hasMore").GetBoolean());
        Assert.Empty(Items(beyond));
        var seen = Ids(first).Concat(Ids(second)).Concat(Ids(third)).ToList();
        Assert.Equal(120, seen.Distinct().Count());
        Assert.Equal(all.OrderBy(id => id), seen.OrderBy(id => id));
    }

    [Fact]
    public async Task Search_Exactly50Matches_HasNoMore()
    {
        var user = await SignInAsync();
        for (var i = 0; i < 50; i++)
        {
            await CreateAsync(user, text: "exactword");
        }

        var page = await SearchAsync(user, "exactword");

        Assert.Equal(50, Items(page).Count);
        Assert.False(page.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task Search_FindsANoteSavedAfterTheFirstSearch_AndStopsFindingTheOldText()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, text: "firsttext");
        Assert.Empty(Items(await SearchAsync(user, "secondtext")));

        // Act
        var save = await user.Client.PutAsync($"/api/notes/{note}", Json($"{{\"title\":\"Untitled\",\"context\":\"\",\"content\":{ContentOf("secondtext")},\"baseVersion\":1}}"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal([note], Ids(await SearchAsync(user, "secondtext")));
        Assert.Empty(Items(await SearchAsync(user, "firsttext")));
    }

    [Fact]
    public async Task Search_FindsTextInNestedChildBlocks()
    {
        var user = await SignInAsync();
        var content = $"{{\"schemaVersion\":1,\"blocks\":[{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"bullet\",\"text\":\"top\",\"children\":[{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"paragraph\",\"text\":\"deepword\"}}]}}]}}";
        var response = await user.Client.PostAsync("/api/notes", Json($"{{\"content\":{content}}}"));
        var note = (await ReadJson(response)).GetProperty("id").GetGuid();

        Assert.Equal([note], Ids(await SearchAsync(user, "deepword")));
    }

    [Fact]
    public async Task Search_ABlankQuery_GivesAnEmptyList()
    {
        var user = await SignInAsync();
        await CreateAsync(user, title: "something");

        foreach (var q in new[] { "", "%20%20%20" })
        {
            var response = await user.Client.GetAsync($"/api/notes/search?q={q}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await ReadJson(response);
            Assert.Empty(Items(body));
            Assert.False(body.GetProperty("hasMore").GetBoolean());
        }
        Assert.Empty(Items(await ReadJson(await user.Client.GetAsync("/api/notes/search"))));
    }

    [Fact]
    public async Task Search_TrimsTheQuery_And200CharactersAreAllowedButMoreIs400()
    {
        var user = await SignInAsync();
        var hit = await CreateAsync(user, title: "spaced");

        var trimmed = await SearchAsync(user, "  spaced  ");
        var ok = await user.Client.GetAsync($"/api/notes/search?q={new string('a', 200)}");
        var tooLong = await user.Client.GetAsync($"/api/notes/search?q={new string('a', 201)}");
        var paddedLong = await user.Client.GetAsync($"/api/notes/search?q=%20{new string('a', 200)}%20");

        Assert.Equal([hit], Ids(trimmed));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.OK, paddedLong.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Equal(["คำค้นต้องไม่เกิน 200 ตัวอักษร"], Errors(await ReadJson(tooLong)));
    }

    [Theory]
    [InlineData("skip=-1")]
    [InlineData("skip=abc")]
    [InlineData("skip=1.5")]
    [InlineData("skip=99999999999")]
    public async Task Search_ABadSkip_Is400(string skip)
    {
        var user = await SignInAsync();

        var response = await user.Client.GetAsync($"/api/notes/search?q=x&{skip}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("%00")]
    public async Task Search_ACharacterTheDatabaseCannotStore_Is400(string q)
    {
        var user = await SignInAsync();

        var response = await user.Client.GetAsync($"/api/notes/search?q=a{q}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Search_ByAnAnonymousCaller_Is401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/notes/search?q=x");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Search_AParentCycleInCorruptData_StopsAtTheCap()
    {
        // Arrange: two notes that are each other's parent, built in the database
        var user = await SignInAsync();
        var a = await CreateAsync(user, title: "cycle-a");
        var b = await CreateAsync(user, title: "cycle-b", parentId: a);
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<JodDbContext>();
            await context.Database.ExecuteSqlAsync($"""UPDATE "Notes" SET "ParentId" = {b} WHERE "Id" = {a}""");
        }

        // Act
        var page = await SearchAsync(user, "cycle-a");

        // Assert
        Assert.Equal(200, Items(page)[0].GetProperty("path").GetArrayLength());
    }

    [Fact]
    public async Task Search_NeverPutsTheQueryOrNoteTextInTheLogs()
    {
        // Arrange
        var marker = "secret-" + Guid.NewGuid().ToString("N");
        var user = await SignInAsync();
        await CreateAsync(user, title: marker, text: marker);

        // Act
        await SearchAsync(user, marker);
        await SearchAsync(user, marker + "-absent");
        await user.Client.GetAsync($"/api/notes/search?q={marker}{new string('z', 300)}");
        await user.Client.GetAsync($"/api/notes/search?q={marker}&skip=-1");

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

    private static string ContentOf(string text) =>
        $"{{\"schemaVersion\":1,\"blocks\":[{{\"id\":\"{Guid.NewGuid()}\",\"type\":\"paragraph\",\"text\":{JsonSerializer.Serialize(text)}}}]}}";

    private static async Task<Guid> CreateAsync(TestUser user, string? title = null, string? text = null, string? context = null, Guid? parentId = null)
    {
        var body = new Dictionary<string, object?>();
        if (title is not null)
        {
            body["title"] = title;
        }
        if (context is not null)
        {
            body["context"] = context;
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

    private static async Task MoveToRootAsync(TestUser user, Guid id) =>
        (await user.Client.PutAsync($"/api/notes/{id}/placement", Json("{\"placement\":\"root\"}"))).EnsureSuccessStatusCode();

    private async Task SetUpdatedAtAsync(DateTimeOffset time, params Guid[] ids)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<JodDbContext>();
        await context.Notes.Where(n => ids.Contains(n.Id)).ExecuteUpdateAsync(s => s.SetProperty(n => n.UpdatedAt, time));
    }

    private static async Task<JsonElement> SearchAsync(TestUser user, string q, int skip = 0)
    {
        var response = await user.Client.GetAsync($"/api/notes/search?q={Uri.EscapeDataString(q)}&skip={skip}");
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
