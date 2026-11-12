using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Jod.Integration.Tests;

public class NoteDiscardEmptyApiTests : IClassFixture<JodWebFactory>
{
    private const string EmptyContent = "{\"schemaVersion\":1,\"blocks\":[]}";
    private const string EmptyParagraph = "{\"schemaVersion\":1,\"blocks\":[{\"id\":\"11111111-1111-4111-8111-111111111111\",\"type\":\"paragraph\",\"text\":\"\"}]}";

    private readonly JodWebFactory _factory;

    public NoteDiscardEmptyApiTests(JodWebFactory factory) => _factory = factory;

    [Fact]
    public async Task Discard_OfAFreshNote_RemovesItForGood_NotEvenInTheTrash()
    {
        var user = await SignInAsync();
        var id = await CreateAsync(user);
        var other = await CreateAsync(user);

        var response = await DiscardAsync(user, id, 1);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await Discarded(response));
        Assert.Equal(HttpStatusCode.NotFound, (await user.Client.GetAsync($"/api/notes/{id}")).StatusCode);
        Assert.Equal([other], (await ListAsync(user, "/api/notes")).Select(n => n.GetProperty("id").GetGuid()));
        Assert.Empty(await ListAsync(user, "/api/notes/trash"));
    }

    [Fact]
    public async Task Discard_OfAnEmptyParagraphNote_Works()
    {
        var user = await SignInAsync();
        var id = await CreateAsync(user);
        await SaveAsync(user, id, "Untitled", "", EmptyParagraph, 1);

        Assert.True(await Discarded(await DiscardAsync(user, id, 2)));
    }

    [Fact]
    public async Task Discard_WithAStaleBaseVersion_KeepsTheNote()
    {
        var user = await SignInAsync();
        var id = await CreateAsync(user);
        await SaveAsync(user, id, "Untitled", "", EmptyContent, 1);

        var response = await DiscardAsync(user, id, 1);

        Assert.False(await Discarded(response));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{id}")).StatusCode);
    }

    [Theory]
    [InlineData("typed", "", EmptyContent)]
    [InlineData("Untitled", "context", EmptyContent)]
    [InlineData("Untitled", "", "{\"schemaVersion\":1,\"blocks\":[{\"id\":\"11111111-1111-4111-8111-111111111111\",\"type\":\"paragraph\",\"text\":\"hi\"}]}")]
    public async Task Discard_OfATouchedNote_KeepsIt(string title, string noteContext, string content)
    {
        var user = await SignInAsync();
        var id = await CreateAsync(user);
        await SaveAsync(user, id, title, noteContext, content, 1);

        Assert.False(await Discarded(await DiscardAsync(user, id, 2)));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{id}")).StatusCode);
    }

    [Theory]
    [InlineData("root")]
    [InlineData("child")]
    public async Task Discard_OfAPlacedNote_KeepsIt(string placement)
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var id = await CreateAsync(user);
        var move = placement == "root"
            ? "{\"placement\":\"root\"}"
            : $"{{\"placement\":\"child\",\"parentId\":\"{parent}\"}}";
        Assert.Equal(HttpStatusCode.OK, (await user.Client.PutAsync($"/api/notes/{id}/placement", Json(move))).StatusCode);

        Assert.False(await Discarded(await DiscardAsync(user, id, 1)));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{id}")).StatusCode);
    }

    [Fact]
    public async Task Discard_OfAChildMadeUnderAParent_KeepsIt()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var child = await CreateAsync(user, parent);

        Assert.False(await Discarded(await DiscardAsync(user, child, 1)));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{child}")).StatusCode);
    }

    [Fact]
    public async Task Discard_OfANoteWithAnAliveChild_KeepsIt()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        await CreateAsync(user, parent);

        Assert.False(await Discarded(await DiscardAsync(user, parent, 1)));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{parent}")).StatusCode);
    }

    [Fact]
    public async Task Discard_OfANoteWithATrashedChild_KeepsIt_WithoutAForeignKeyError()
    {
        var user = await SignInAsync();
        var parent = await CreateAsync(user);
        var child = await CreateAsync(user, parent);
        Assert.Equal(HttpStatusCode.OK, (await user.Client.DeleteAsync($"/api/notes/{child}?scope=single")).StatusCode);

        var response = await DiscardAsync(user, parent, 1);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(await Discarded(response));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{parent}")).StatusCode);
    }

    [Fact]
    public async Task Discard_OfADeletedNote_Is404()
    {
        var user = await SignInAsync();
        var id = await CreateAsync(user);
        await user.Client.DeleteAsync($"/api/notes/{id}");

        Assert.Equal(HttpStatusCode.NotFound, (await DiscardAsync(user, id, 1)).StatusCode);
        Assert.Single(await ListAsync(user, "/api/notes/trash"));
    }

    [Fact]
    public async Task Discard_OfAForeignOrMissingNote_Is404_AndTheForeignNoteStays()
    {
        var owner = await SignInAsync();
        var stranger = await SignInAsync();
        var id = await CreateAsync(owner);

        Assert.Equal(HttpStatusCode.NotFound, (await DiscardAsync(stranger, id, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await DiscardAsync(stranger, Guid.NewGuid(), 1)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.GetAsync($"/api/notes/{id}")).StatusCode);
    }

    [Fact]
    public async Task Discard_WithoutSignIn_Is401()
    {
        var response = await _factory.CreateClient().PostAsync($"/api/notes/{Guid.NewGuid()}/discard-empty", Json("{\"baseVersion\":1}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"baseVersion\":-1}")]
    [InlineData("{\"baseVersion\":\"1\"}")]
    [InlineData("{\"baseVersion\":null}")]
    public async Task Discard_WithABadBody_Is400_AndKeepsTheNote(string body)
    {
        var user = await SignInAsync();
        var id = await CreateAsync(user);

        var response = await user.Client.PostAsync($"/api/notes/{id}/discard-empty", Json(body));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{id}")).StatusCode);
    }

    [Fact]
    public async Task Discard_AndCreatingAChildAtTheSameMoment_NeverLeavesAnOrphan()
    {
        var user = await SignInAsync();
        for (var round = 0; round < 20; round++)
        {
            var id = await CreateAsync(user);

            var results = await Task.WhenAll(
                DiscardAsync(user, id, 1),
                user.Client.PostAsync("/api/notes", Json($"{{\"parentId\":\"{id}\"}}")));

            var discarded = await Discarded(results[0]);
            if (discarded)
            {
                Assert.Equal(HttpStatusCode.NotFound, results[1].StatusCode);
            }
            else
            {
                Assert.Equal(HttpStatusCode.Created, results[1].StatusCode);
                Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync($"/api/notes/{id}")).StatusCode);
            }
            var alive = (await ListAsync(user, "/api/notes")).Select(n => n.GetProperty("id").GetGuid()).ToHashSet();
            Assert.All(await ListAsync(user, "/api/notes"), n =>
                Assert.True(n.GetProperty("parentId").ValueKind == JsonValueKind.Null || alive.Contains(n.GetProperty("parentId").GetGuid()), $"orphan in round {round}"));
        }
    }

    [Fact]
    public async Task Discard_NeverPutsNoteContentInTheLogs()
    {
        var marker = "secret-" + Guid.NewGuid().ToString("N");
        var user = await SignInAsync();
        var id = await CreateAsync(user);
        await SaveAsync(user, id, marker, marker, EmptyContent, 1);

        await DiscardAsync(user, id, 2);
        await DiscardAsync(user, id, 2);

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

    private static async Task SaveAsync(TestUser user, Guid id, string title, string noteContext, string content, int baseVersion)
    {
        var body = $"{{\"title\":{JsonSerializer.Serialize(title)},\"context\":{JsonSerializer.Serialize(noteContext)},\"content\":{content},\"baseVersion\":{baseVersion}}}";
        Assert.Equal(HttpStatusCode.OK, (await user.Client.PutAsync($"/api/notes/{id}", Json(body))).StatusCode);
    }

    private static Task<HttpResponseMessage> DiscardAsync(TestUser user, Guid id, int baseVersion) =>
        user.Client.PostAsync($"/api/notes/{id}/discard-empty", Json($"{{\"baseVersion\":{baseVersion}}}"));

    private static async Task<bool> Discarded(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJson(response)).GetProperty("discarded").GetBoolean();
    }

    private static async Task<List<JsonElement>> ListAsync(TestUser user, string url) =>
        (await ReadJson(await user.Client.GetAsync(url))).EnumerateArray().ToList();

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
