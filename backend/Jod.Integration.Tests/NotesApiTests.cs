using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Jod.Service.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jod.Integration.Tests;

public class NotesApiTests : IClassFixture<JodWebFactory>
{
    private const string ReferencePattern = "^[A-HJ-NP-Z2-9]{8}$";
    private const string EmptyContent = "{\"schemaVersion\":1,\"blocks\":[]}";
    private const string InvalidContentMessage = "เนื้อหาของโน้ตไม่ถูกต้อง";
    private const string NotFoundMessage = "ไม่พบโน้ตนี้";
    private const string ConflictMessage = "โน้ตนี้ถูกแก้จากที่อื่นแล้ว";

    private readonly JodWebFactory _factory;

    public NotesApiTests(JodWebFactory factory) => _factory = factory;

    // ---- create / get / list ----

    [Fact]
    public async Task Create_WithAnEmptyJsonBody_Returns201WithDefaults()
    {
        // Arrange
        var user = await SignInAsync();

        // Act
        var response = await user.Client.PostAsync("/api/notes", Json("{}"));

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var note = await ReadJson(response);
        Assert.Equal("Untitled", note.GetProperty("title").GetString());
        Assert.Equal("", note.GetProperty("context").GetString());
        Assert.Equal(1, note.GetProperty("version").GetInt32());
        Assert.True(SameJson(Parse(EmptyContent), note.GetProperty("content")));
        Assert.Equal(note.GetProperty("createdAt").GetDateTimeOffset(), note.GetProperty("updatedAt").GetDateTimeOffset());
        Assert.Equal(TimeSpan.Zero, note.GetProperty("createdAt").GetDateTimeOffset().Offset);
        Assert.Equal(
            ["id", "title", "context", "content", "version", "createdAt", "updatedAt"],
            note.EnumerateObject().Select(property => property.Name));
        Assert.EndsWith($"/api/notes/{note.GetProperty("id").GetGuid()}", response.Headers.Location?.ToString());
    }

    [Fact]
    public async Task Create_WithNoBodyAtAll_Returns201WithDefaults()
    {
        // Arrange
        var user = await SignInAsync();

        // Act
        var response = await user.Client.PostAsync("/api/notes", null);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var note = await ReadJson(response);
        Assert.Equal("Untitled", note.GetProperty("title").GetString());
        Assert.Equal(1, note.GetProperty("version").GetInt32());
    }

    [Fact]
    public async Task Create_WithValues_StoresThemAndGetReturnsTheSameNote()
    {
        // Arrange
        var user = await SignInAsync();
        var content = Doc(Paragraph(NewId(), "สวัสดี 😀"));

        // Act
        var created = await ReadJson(await user.Client.PostAsync("/api/notes", Json(Body("My note", "for me", content))));
        var fetched = await user.Client.GetAsync($"/api/notes/{created.GetProperty("id").GetGuid()}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        var note = await ReadJson(fetched);
        Assert.Equal("My note", note.GetProperty("title").GetString());
        Assert.Equal("for me", note.GetProperty("context").GetString());
        Assert.True(SameJson(Parse(content), note.GetProperty("content")));
        Assert.Equal(created.GetProperty("createdAt").GetDateTimeOffset(), note.GetProperty("createdAt").GetDateTimeOffset());
        Assert.Equal(created.GetProperty("updatedAt").GetDateTimeOffset(), note.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\"\"")]
    [InlineData("\"   \"")]
    [InlineData("\" \\t\\n \"")]
    public async Task Create_WithEmptyOrWhitespaceTitle_StoresUntitled(string titleJson)
    {
        // Arrange
        var user = await SignInAsync();

        // Act
        var response = await user.Client.PostAsync("/api/notes", Json($"{{\"title\":{titleJson}}}"));

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Untitled", (await ReadJson(response)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Create_TrimsTheTitle()
    {
        // Arrange
        var user = await SignInAsync();

        // Act
        var note = await CreateAsync(user, title: "  padded title \n");

        // Assert
        Assert.Equal("padded title", note.GetProperty("title").GetString());
    }

    [Fact]
    public async Task List_ShowsOnlyTheCallersNotes_NewestChangeFirst_WithoutContent()
    {
        // Arrange
        var user = await SignInAsync();
        var other = await SignInAsync();
        var first = await CreateAsync(user, title: "first");
        var second = await CreateAsync(user, title: "second");
        var third = await CreateAsync(user, title: "third");
        var othersNote = await CreateAsync(other, title: "other's");
        await SaveAsync(user, first, title: "first, edited");

        // Act
        var response = await user.Client.GetAsync("/api/notes");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = (await ReadJson(response)).EnumerateArray().ToList();
        Assert.Equal(
            [first.GetProperty("id").GetGuid(), third.GetProperty("id").GetGuid(), second.GetProperty("id").GetGuid()],
            list.Select(item => item.GetProperty("id").GetGuid()));
        Assert.Equal(["first, edited", "third", "second"], list.Select(item => item.GetProperty("title").GetString()));
        Assert.All(list, item => Assert.Equal(["id", "title", "updatedAt"], item.EnumerateObject().Select(p => p.Name)));
        Assert.DoesNotContain(list, item => item.GetProperty("id").GetGuid() == othersNote.GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task List_ForAUserWithoutNotes_IsAnEmptyArray()
    {
        // Arrange
        var user = await SignInAsync();

        // Act
        var response = await user.Client.GetAsync("/api/notes");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await ReadJson(response)).EnumerateArray());
    }

    // ---- save and version ----

    [Fact]
    public async Task Save_WithTheStoredVersion_StoresAndRaisesTheVersionByExactlyOne()
    {
        // Arrange
        var user = await SignInAsync();
        var created = await CreateAsync(user);
        var id = created.GetProperty("id").GetGuid();
        var content = Doc(Paragraph(NewId(), "saved"));

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("New title", "new context", content, 1)));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await ReadJson(response);
        Assert.Equal(2, saved.GetProperty("version").GetInt32());
        Assert.Equal("New title", saved.GetProperty("title").GetString());
        Assert.Equal("new context", saved.GetProperty("context").GetString());
        Assert.True(SameJson(Parse(content), saved.GetProperty("content")));
        Assert.Equal(created.GetProperty("createdAt").GetDateTimeOffset(), saved.GetProperty("createdAt").GetDateTimeOffset());
        Assert.True(saved.GetProperty("updatedAt").GetDateTimeOffset() > created.GetProperty("updatedAt").GetDateTimeOffset());
        var fetched = await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"));
        Assert.True(SameJson(saved, fetched));
    }

    [Fact]
    public async Task Save_EveryTime_RaisesTheVersionByOne_ForTitleContextAndContentAlike()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "t", context: "c", content: Doc(Paragraph(NewId(), "x")));
        var id = note.GetProperty("id").GetGuid();
        var sameContent = note.GetProperty("content").GetRawText();

        // Act
        var titleOnly = await SaveAsync(user, note, title: "t2", context: "c", content: sameContent);
        var contextOnly = await SaveAsync(user, titleOnly, title: "t2", context: "c2", content: sameContent);
        var contentOnly = await SaveAsync(user, contextOnly, title: "t2", context: "c2", content: Doc(Paragraph(NewId(), "y")));
        var nothingChanged = await SaveAsync(user, contentOnly, title: "t2", context: "c2", content: contentOnly.GetProperty("content").GetRawText());

        // Assert
        Assert.Equal([2, 3, 4, 5], new[] { titleOnly, contextOnly, contentOnly, nothingChanged }.Select(Version));
        Assert.Equal(5, Version(await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"))));
    }

    [Theory]
    [InlineData("\"\"")]
    [InlineData("\" \\t\\n \"")]
    [InlineData("\"   \"")]
    public async Task Save_WithEmptyOrWhitespaceTitle_StoresUntitled(string titleJson)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "had a title");
        var id = note.GetProperty("id").GetGuid();

        // Act
        var response = await user.Client.PutAsync(
            $"/api/notes/{id}", Json($"{{\"title\":{titleJson},\"context\":\"\",\"content\":{EmptyContent},\"baseVersion\":1}}"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Untitled", (await ReadJson(response)).GetProperty("title").GetString());
    }

    [Theory]
    [InlineData("\"context\":\"\",\"content\":EMPTY,\"baseVersion\":1")]
    [InlineData("\"title\":null,\"context\":\"\",\"content\":EMPTY,\"baseVersion\":1")]
    [InlineData("\"title\":\"changed\",\"content\":EMPTY,\"baseVersion\":1")]
    [InlineData("\"title\":\"changed\",\"context\":null,\"content\":EMPTY,\"baseVersion\":1")]
    public async Task Save_WithAMissingOrNullTitleOrContext_Returns400AndStoresNothing(string members)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "keep me", context: "keep this too");
        var id = note.GetProperty("id").GetGuid();
        var body = "{" + members.Replace("EMPTY", EmptyContent) + "}";

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{id}", Json(body));

        // Assert
        var problem = await AssertBadRequestAsync(response);
        Assert.Equal(["ข้อมูลที่ส่งมาไม่ถูกต้อง"], ReadErrors(problem));
        var stored = await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"));
        Assert.Equal("keep me", stored.GetProperty("title").GetString());
        Assert.Equal("keep this too", stored.GetProperty("context").GetString());
        Assert.Equal(1, Version(stored));
    }

    [Fact]
    public async Task Save_WithAnEmptyContext_StoresItAsEmpty()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, context: "had a context");
        var id = note.GetProperty("id").GetGuid();

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("t", "", EmptyContent, 1)));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("", (await ReadJson(response)).GetProperty("context").GetString());
        Assert.Equal("", (await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"))).GetProperty("context").GetString());
    }

    [Fact]
    public async Task Save_WithAStaleBaseVersion_Returns409WithTheCurrentNote_AndStoresNothing()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "v1");
        var id = note.GetProperty("id").GetGuid();
        var current = await SaveAsync(user, note, title: "v2 from the other tab", context: "other tab context");
        var staleMarker = $"stale-{Guid.NewGuid():N}";

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{id}", Json(Body(staleMarker, staleMarker, EmptyContent, 1)));

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.Conflict);
        Assert.Equal([ConflictMessage], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        var payload = problem.GetProperty("payload");
        Assert.Equal(2, Version(payload));
        Assert.Equal("v2 from the other tab", payload.GetProperty("title").GetString());
        Assert.True(SameJson(current, payload));
        Assert.DoesNotContain(staleMarker, await ReadBody(response));
        Assert.True(SameJson(current, await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"))));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(-1)]
    [InlineData(int.MaxValue)]
    public async Task Save_WithAnyBaseVersionExceptTheStoredOne_Returns409(int baseVersion)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);

        // Act
        var response = await user.Client.PutAsync(
            $"/api/notes/{note.GetProperty("id").GetGuid()}", Json(Body("t", "", EmptyContent, baseVersion)));

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.Conflict);
        Assert.Equal(1, Version(problem.GetProperty("payload")));
    }

    [Fact]
    public async Task Save_TwoRequestsAtTheSameTimeWithTheSameBaseVersion_OneSucceedsAndTheOthersConflict()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        var id = note.GetProperty("id").GetGuid();
        const int rounds = 5;
        const int parallelSaves = 8;

        for (var round = 1; round <= rounds; round++)
        {
            var baseVersion = round;

            // Act
            var responses = await Task.WhenAll(Enumerable.Range(0, parallelSaves).Select(attempt =>
                Task.Run(() => user.Client.PutAsync(
                    $"/api/notes/{id}", Json(Body($"round {round} attempt {attempt}", "", EmptyContent, baseVersion))))));

            // Assert
            var winners = responses.Where(response => response.StatusCode == HttpStatusCode.OK).ToList();
            Assert.Single(winners);
            Assert.Equal(parallelSaves - 1, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
            var winner = await ReadJson(winners[0]);
            Assert.Equal(baseVersion + 1, Version(winner));
            var stored = await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"));
            Assert.Equal(baseVersion + 1, Version(stored));
            Assert.Equal(winner.GetProperty("title").GetString(), stored.GetProperty("title").GetString());
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData(",\"baseVersion\":null")]
    [InlineData(",\"baseVersion\":\"abc\"")]
    [InlineData(",\"baseVersion\":\"1\"")]
    [InlineData(",\"baseVersion\":1.5")]
    [InlineData(",\"baseVersion\":true")]
    [InlineData(",\"baseVersion\":[1]")]
    [InlineData(",\"baseVersion\":99999999999")]
    public async Task Save_WithAMissingOrMalformedBaseVersion_Returns400(string baseVersionMember)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "keep me");
        var body = $"{{\"title\":\"changed\",\"context\":\"\",\"content\":{EmptyContent}{baseVersionMember}}}";

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{note.GetProperty("id").GetGuid()}", Json(body));

        // Assert
        await AssertBadRequestAsync(response);
        var stored = await ReadJson(await user.Client.GetAsync($"/api/notes/{note.GetProperty("id").GetGuid()}"));
        Assert.Equal("keep me", stored.GetProperty("title").GetString());
        Assert.Equal(1, Version(stored));
    }

    [Theory]
    [InlineData("{\"title\":\"t\",\"context\":\"\",\"baseVersion\":1}")]
    [InlineData("{\"title\":\"t\",\"context\":\"\",\"content\":null,\"baseVersion\":1}")]
    [InlineData("{\"title\":\"t\",\"context\":\"\",\"content\":[],\"baseVersion\":1}")]
    [InlineData("[]")]
    public async Task Save_WithoutAUsableContent_Returns400(string body)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{note.GetProperty("id").GetGuid()}", Json(body));

        // Assert
        await AssertBadRequestAsync(response);
    }

    // ---- owner isolation and sign-in ----

    [Fact]
    public async Task Get_AnotherUsersNote_Returns404WithTheSameAnswerAsAMissingNote()
    {
        // Arrange
        var owner = await SignInAsync();
        var stranger = await SignInAsync();
        var note = await CreateAsync(owner);

        // Act
        var foreign = await stranger.Client.GetAsync($"/api/notes/{note.GetProperty("id").GetGuid()}");
        var missing = await stranger.Client.GetAsync($"/api/notes/{Guid.NewGuid()}");

        // Assert
        await AssertSameNotFoundAsync(foreign, missing);
    }

    [Fact]
    public async Task Save_AnotherUsersNote_Returns404WithTheSameAnswerAsAMissingNote_AndChangesNothing()
    {
        // Arrange
        var owner = await SignInAsync();
        var stranger = await SignInAsync();
        var note = await CreateAsync(owner, title: "mine");
        var id = note.GetProperty("id").GetGuid();

        // Act
        var foreign = await stranger.Client.PutAsync($"/api/notes/{id}", Json(Body("hijacked", "", EmptyContent, 1)));
        var foreignWrongVersion = await stranger.Client.PutAsync($"/api/notes/{id}", Json(Body("hijacked", "", EmptyContent, 7)));
        var missing = await stranger.Client.PutAsync($"/api/notes/{Guid.NewGuid()}", Json(Body("hijacked", "", EmptyContent, 1)));

        // Assert
        await AssertSameNotFoundAsync(foreign, missing);
        Assert.Equal(HttpStatusCode.NotFound, foreignWrongVersion.StatusCode);
        var stored = await ReadJson(await owner.Client.GetAsync($"/api/notes/{id}"));
        Assert.Equal("mine", stored.GetProperty("title").GetString());
        Assert.Equal(1, Version(stored));
    }

    [Fact]
    public async Task EveryEndpoint_WithoutASignedInUser_Returns401()
    {
        // Arrange
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        // Act
        var responses = new[]
        {
            await client.PostAsync("/api/notes", Json("{}")),
            await client.GetAsync("/api/notes"),
            await client.GetAsync($"/api/notes/{id}"),
            await client.PutAsync($"/api/notes/{id}", Json(Body("t", "", EmptyContent, 1))),
        };

        // Assert
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode));
    }

    [Fact]
    public async Task OwnerIdInTheBody_IsIgnored_OnCreateAndOnSave()
    {
        // Arrange
        var caller = await SignInAsync();
        var victim = await SignInAsync();

        // Act
        var created = await caller.Client.PostAsync("/api/notes", Json($"{{\"title\":\"x\",\"ownerId\":\"{victim.UserId}\"}}"));
        var id = (await ReadJson(created)).GetProperty("id").GetGuid();
        var saved = await caller.Client.PutAsync(
            $"/api/notes/{id}",
            Json($"{{\"title\":\"y\",\"context\":\"\",\"content\":{EmptyContent},\"baseVersion\":1,\"ownerId\":\"{victim.UserId}\"}}"));

        // Assert
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await caller.Client.GetAsync($"/api/notes/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await victim.Client.GetAsync($"/api/notes/{id}")).StatusCode);
        Assert.Empty((await ReadJson(await victim.Client.GetAsync("/api/notes"))).EnumerateArray());
        await using var scope = new ScopedDatabase(_factory);
        Assert.Equal(caller.UserId, (await scope.Context.Notes.SingleAsync(note => note.Id == id)).OwnerId);
    }

    // ---- content rules over HTTP ----

    [Theory]
    [MemberData(nameof(BrokenContents))]
    public async Task CreateAndSave_WithBrokenContent_Return400WithThaiMessageAndReference(string content)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user, title: "intact");
        var id = note.GetProperty("id").GetGuid();

        // Act
        var created = await user.Client.PostAsync("/api/notes", Json(Body("t", "", content)));
        var saved = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("t", "", content, 1)));

        // Assert
        var createdProblem = await AssertBadRequestAsync(created);
        var savedProblem = await AssertBadRequestAsync(saved);
        Assert.Equal([InvalidContentMessage], ReadErrors(createdProblem));
        Assert.Equal([InvalidContentMessage], ReadErrors(savedProblem));
        var stored = await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"));
        Assert.Equal("intact", stored.GetProperty("title").GetString());
        Assert.Equal(1, Version(stored));
    }

    public static TheoryData<string> BrokenContents()
    {
        var id = NewId();
        return new TheoryData<string>
        {
            "[]",
            "{\"schemaVersion\":2,\"blocks\":[]}",
            "{\"blocks\":[]}",
            "{\"schemaVersion\":1,\"blocks\":[],\"extra\":true}",
            Doc("{\"id\":\"" + id + "\",\"type\":\"image\",\"text\":\"a\"}"),
            Doc("{\"id\":\"" + id + "\",\"type\":\"paragraph\",\"text\":\"a\",\"color\":\"red\"}"),
            Doc("{\"id\":\"not-a-guid\",\"type\":\"paragraph\",\"text\":\"a\"}"),
            Doc(Paragraph(id, "a"), Paragraph(id, "b")),
            Doc(Parent("toggle", id, "a", Paragraph(id, "child"))),
            Doc("{\"id\":\"" + id + "\",\"type\":\"paragraph\",\"text\":\"a\",\"children\":[]}"),
            Doc("{\"id\":\"" + id + "\",\"type\":\"heading\",\"text\":\"a\",\"level\":4}"),
            Doc("{\"id\":\"" + id + "\",\"type\":\"heading\",\"text\":\"a\",\"level\":0}"),
            Doc("{\"id\":\"" + id + "\",\"type\":\"paragraph\",\"text\":5}"),
            Doc("{\"id\":\"" + id + "\",\"type\":\"paragraph\",\"text\":\"a\\u0000b\"}"),
            Doc("{\"id\":\"" + id + "\",\"type\":\"paragraph\",\"text\":\"a\\ud800b\"}"),
        };
    }

    [Fact]
    public async Task Create_With101NestedBlockLevels_Returns400AndWith100IsStoredAndReadBackWithEveryId()
    {
        // Arrange
        var user = await SignInAsync();
        var ids100 = Enumerable.Range(0, 100).Select(_ => NewId()).ToList();
        var ids101 = ids100.Append(NewId()).ToList();

        // Act
        var accepted = await user.Client.PostAsync("/api/notes", Json(Body("deep", "", NestedBullets(ids100))));
        var rejected = await user.Client.PostAsync("/api/notes", Json(Body("deeper", "", NestedBullets(ids101))));

        // Assert
        Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        var created = await ReadJson(accepted);
        var problem = await AssertBadRequestAsync(rejected);
        Assert.Equal(["เนื้อหาของโน้ตซ้อนลึกเกินกำหนด"], ReadErrors(problem));
        var fetched = await ReadJson(await user.Client.GetAsync($"/api/notes/{created.GetProperty("id").GetGuid()}"));
        Assert.Equal(ids100, IdsDownTheChain(fetched.GetProperty("content")));
        Assert.True(SameJson(Parse(NestedBullets(ids100)), fetched.GetProperty("content")));
    }

    [Fact]
    public async Task Save_With100NestedBlockLevels_ThenAConflict_BothCarryTheDeepContent()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        var id = note.GetProperty("id").GetGuid();
        var ids = Enumerable.Range(0, 100).Select(_ => NewId()).ToList();

        // Act
        var saved = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("deep", "", NestedBullets(ids), 1)));
        var conflict = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("late", "", EmptyContent, 1)));

        // Assert
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(ids, IdsDownTheChain((await ReadJson(saved)).GetProperty("content")));
        var problem = await ReadProblemAsync(conflict, HttpStatusCode.Conflict);
        Assert.Equal(ids, IdsDownTheChain(problem.GetProperty("payload").GetProperty("content")));
    }

    [Fact]
    public async Task Content_IsStoredAsJsonb_AndComesBackWithTheSameBlocksAndIdsEvenIfKeyOrderAndSpacingChange()
    {
        // Arrange
        var user = await SignInAsync();
        var ids = Enumerable.Range(0, 5).Select(_ => NewId()).ToList();
        // Note: keys deliberately out of alphabetical order and padded with whitespace, jsonb re-orders and drops them
        var content = "{ \"blocks\" : [\n"
            + $"  {{ \"text\":\"Ünïcode สวัสดี 😀\", \"type\":\"heading\", \"level\":2, \"id\":\"{ids[0]}\" }},\n"
            + $"  {{ \"children\":[ {{ \"text\":\"inner\", \"id\":\"{ids[2]}\", \"type\":\"checklist\", \"checked\":true }} ],"
            + $" \"text\":\"outer\", \"type\":\"toggle\", \"id\":\"{ids[1]}\" }},\n"
            + $"  {{ \"language\":\"csharp\", \"text\":\"var a = 1;\\n\\\"q\\\"\", \"type\":\"code\", \"id\":\"{ids[3]}\" }},\n"
            + $"  {{ \"type\":\"divider\", \"id\":\"{ids[4]}\" }}\n"
            + "], \"schemaVersion\" : 1 }";

        // Act
        var created = await CreateAsync(user, content: content);
        var fetched = await ReadJson(await user.Client.GetAsync($"/api/notes/{created.GetProperty("id").GetGuid()}"));

        // Assert
        Assert.True(SameJson(Parse(content), fetched.GetProperty("content")));
        var blocks = fetched.GetProperty("content").GetProperty("blocks").EnumerateArray().ToList();
        Assert.Equal([ids[0], ids[1], ids[3], ids[4]], blocks.Select(block => block.GetProperty("id").GetString()));
        Assert.Equal(ids[2], blocks[1].GetProperty("children")[0].GetProperty("id").GetString());
        Assert.Equal("Ünïcode สวัสดี 😀", blocks[0].GetProperty("text").GetString());
        await using var scope = new ScopedDatabase(_factory);
        var columnType = await scope.Context.Database
            .SqlQuery<string>($"SELECT data_type AS \"Value\" FROM information_schema.columns WHERE table_name = 'Notes' AND column_name = 'Content'")
            .SingleAsync();
        Assert.Equal("jsonb", columnType);
    }

    // ---- size and length limits over HTTP ----

    [Fact]
    public async Task Content_ExactlyOneMiBIsAccepted_AndOneByteMoreIsRejected()
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        var id = note.GetProperty("id").GetGuid();

        // Act
        var accepted = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("t", "", ContentOfBytes(1_048_576), 1)));
        var rejected = await user.Client.PutAsync($"/api/notes/{id}", Json(Body("t", "", ContentOfBytes(1_048_577), 2)));

        // Assert
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var problem = await AssertBadRequestAsync(rejected);
        Assert.Equal(["เนื้อหาของโน้ตใหญ่เกินกำหนด"], ReadErrors(problem));
        Assert.Equal(2, Version(await ReadJson(await user.Client.GetAsync($"/api/notes/{id}"))));
    }

    [Theory]
    [InlineData(199, true)]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public async Task Title_IsLimitedTo200Characters(int length, bool accepted)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        var title = new string('a', length);

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{note.GetProperty("id").GetGuid()}", Json(Body(title, "", EmptyContent, 1)));

        // Assert
        await AssertLimitAsync(response, accepted, "ชื่อโน้ตต้องไม่เกิน 200 ตัวอักษร");
    }

    [Theory]
    [InlineData(1999, true)]
    [InlineData(2000, true)]
    [InlineData(2001, false)]
    public async Task Context_IsLimitedTo2000Characters(int length, bool accepted)
    {
        // Arrange
        var user = await SignInAsync();
        var note = await CreateAsync(user);
        var context = new string('a', length);

        // Act
        var response = await user.Client.PutAsync($"/api/notes/{note.GetProperty("id").GetGuid()}", Json(Body("t", context, EmptyContent, 1)));

        // Assert
        await AssertLimitAsync(response, accepted, "บริบทของโน้ตต้องไม่เกิน 2000 ตัวอักษร");
    }

    [Theory]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public async Task TitleAndContext_AreCountedByCodePoints_SoEmojiAndThaiFitTheirLimits(int count, bool accepted)
    {
        // Arrange
        var user = await SignInAsync();
        var emojiTitle = string.Concat(Enumerable.Repeat("😀", count));
        var thaiTitle = string.Concat(Enumerable.Repeat("กำ", count / 2)) + (count % 2 == 1 ? "ก" : "");

        // Act
        var emoji = await user.Client.PostAsync("/api/notes", Json(Body(emojiTitle, "", EmptyContent)));
        var thai = await user.Client.PostAsync("/api/notes", Json(Body(thaiTitle, "", EmptyContent)));

        // Assert
        await AssertLimitAsync(emoji, accepted, "ชื่อโน้ตต้องไม่เกิน 200 ตัวอักษร");
        await AssertLimitAsync(thai, accepted, "ชื่อโน้ตต้องไม่เกิน 200 ตัวอักษร");
        if (accepted)
        {
            Assert.Equal(emojiTitle, (await ReadJson(emoji)).GetProperty("title").GetString());
        }
    }

    [Theory]
    [InlineData("\"a\\u0000b\"")]
    [InlineData("\"a\\ud800b\"")]
    public async Task Title_WithACharacterTheDatabaseCannotStore_Returns400(string titleJson)
    {
        // Arrange
        var user = await SignInAsync();

        // Act
        var response = await user.Client.PostAsync("/api/notes", Json($"{{\"title\":{titleJson}}}"));

        // Assert
        await AssertBadRequestAsync(response);
    }

    // ---- privacy ----

    [Fact]
    public async Task NoteTitleContextAndContent_NeverAppearInLogsOrErrorBodies()
    {
        // Arrange
        var owner = await SignInAsync();
        var stranger = await SignInAsync();
        var marker = $"privacy-{Guid.NewGuid():N}";
        var secretContent = Doc(Paragraph(NewId(), marker + "-text"));
        var created = await CreateAsync(owner, title: marker + "-title", context: marker + "-context", content: secretContent);
        var id = created.GetProperty("id").GetGuid();
        var brokenContent = Doc("{\"id\":\"" + NewId() + "\",\"type\":\"nope\",\"text\":\"" + marker + "-broken\"}");
        var errorBodies = new List<string>();

        // Act
        errorBodies.Add(await ReadBody(await owner.Client.PutAsync($"/api/notes/{id}", Json(Body(marker + "-t2", marker + "-c2", brokenContent, 1)))));
        errorBodies.Add(await ReadBody(await owner.Client.PostAsync("/api/notes", Json(Body(marker + "-t3", marker + "-c3", brokenContent)))));
        errorBodies.Add(await ReadBody(await owner.Client.PostAsync("/api/notes", Json(Body(new string('x', 201) + marker, "", EmptyContent)))));
        errorBodies.Add(await ReadBody(await stranger.Client.GetAsync($"/api/notes/{id}")));
        errorBodies.Add(await ReadBody(await stranger.Client.PutAsync($"/api/notes/{id}", Json(Body(marker + "-t4", marker + "-c4", secretContent, 1)))));
        var conflict = await ReadBody(await owner.Client.PutAsync($"/api/notes/{id}", Json(Body(marker + "-t5", marker + "-c5", secretContent, 9))));
        await owner.Client.PutAsync($"/api/notes/{id}", Json(Body(marker + "-t6", marker + "-c6", secretContent, 1)));

        // Assert
        Assert.All(errorBodies, body => Assert.DoesNotContain(marker, body));
        Assert.Contains(marker + "-title", conflict);
        Assert.DoesNotContain(marker + "-t5", conflict);
        Assert.DoesNotContain(_factory.LogEntries, entry =>
            entry.Message.Contains(marker) || (entry.ExceptionText?.Contains(marker) ?? false));
        Assert.Contains(_factory.LogEntries, entry => entry.Message.Contains("Request failed"));
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

    private static async Task<JsonElement> CreateAsync(
        TestUser user, string title = "t", string context = "", string content = EmptyContent)
    {
        var response = await user.Client.PostAsync("/api/notes", Json(Body(title, context, content)));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJson(response);
    }

    /// <summary>Saves with the version of the given (last seen) note and returns the new note.</summary>
    private static async Task<JsonElement> SaveAsync(
        TestUser user, JsonElement seen, string title = "t", string context = "", string? content = null)
    {
        var id = seen.GetProperty("id").GetGuid();
        var response = await user.Client.PutAsync(
            $"/api/notes/{id}", Json(Body(title, context, content ?? EmptyContent, Version(seen))));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private static int Version(JsonElement note) => note.GetProperty("version").GetInt32();

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static string Body(string title, string context, string content, int? baseVersion = null) =>
        $"{{\"title\":{JsonSerializer.Serialize(title)},\"context\":{JsonSerializer.Serialize(context)},\"content\":{content}"
        + (baseVersion is null ? "" : $",\"baseVersion\":{baseVersion}") + "}";

    private static string NewId() => Guid.NewGuid().ToString();

    private static string Doc(params string[] blocks) => $"{{\"schemaVersion\":1,\"blocks\":[{string.Join(",", blocks)}]}}";

    private static string Paragraph(string id, string text) =>
        $"{{\"id\":\"{id}\",\"type\":\"paragraph\",\"text\":{JsonSerializer.Serialize(text)}}}";

    private static string Parent(string type, string id, string text, string children) =>
        $"{{\"id\":\"{id}\",\"type\":\"{type}\",\"text\":{JsonSerializer.Serialize(text)},\"children\":[{children}]}}";

    // Note: a chain of bullets, each the only child of the one before
    private static string NestedBullets(IReadOnlyList<string> ids)
    {
        var json = new StringBuilder("{\"schemaVersion\":1,\"blocks\":[");
        foreach (var id in ids)
        {
            json.Append($"{{\"id\":\"{id}\",\"type\":\"bullet\",\"text\":\"\",\"children\":[");
        }
        json.Append(string.Concat(Enumerable.Repeat("]}", ids.Count)));
        return json.Append("]}").ToString();
    }

    private static List<string> IdsDownTheChain(JsonElement content)
    {
        var ids = new List<string>();
        var blocks = content.GetProperty("blocks");
        while (blocks.GetArrayLength() > 0)
        {
            var block = blocks[0];
            ids.Add(block.GetProperty("id").GetString()!);
            blocks = block.GetProperty("children");
        }
        return ids;
    }

    private static string ContentOfBytes(int totalBytes)
    {
        var prefix = $"{{\"schemaVersion\":1,\"blocks\":[{{\"id\":\"{NewId()}\",\"type\":\"paragraph\",\"text\":\"";
        const string suffix = "\"}]}";
        return prefix + new string('a', totalBytes - prefix.Length - suffix.Length) + suffix;
    }

    // Note: ReadFromJsonAsync<JsonElement> stops at 64 levels, a note with 100 block levels is about 200 deep
    private static JsonElement Parse(string json) =>
        JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 1000 }).RootElement;

    private static async Task<string> ReadBody(HttpResponseMessage response) => await response.Content.ReadAsStringAsync();

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) => Parse(await ReadBody(response));

    private static async Task<JsonElement> ReadProblemAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await ReadJson(response);
        Assert.Equal((int)expected, problem.GetProperty("status").GetInt32());
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        return problem;
    }

    private static string[] ReadErrors(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateArray().Select(error => error.GetString()!).ToArray();

    private static async Task<JsonElement> AssertBadRequestAsync(HttpResponseMessage response)
    {
        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.NotEmpty(ReadErrors(problem));
        Assert.All(ReadErrors(problem), message => Assert.Matches("[฀-๿]", message));
        return problem;
    }

    private static async Task AssertLimitAsync(HttpResponseMessage response, bool accepted, string rejectedMessage)
    {
        if (accepted)
        {
            Assert.True(response.IsSuccessStatusCode, $"expected success, got {(int)response.StatusCode}");
            return;
        }
        Assert.Equal([rejectedMessage], ReadErrors(await AssertBadRequestAsync(response)));
    }

    private static async Task AssertSameNotFoundAsync(HttpResponseMessage foreign, HttpResponseMessage missing)
    {
        var foreignProblem = await ReadProblemAsync(foreign, HttpStatusCode.NotFound);
        var missingProblem = await ReadProblemAsync(missing, HttpStatusCode.NotFound);
        Assert.Equal([NotFoundMessage], ReadErrors(foreignProblem));
        // Note: the reference is random on purpose, everything else must be identical
        Assert.Equal(WithoutReference(missingProblem), WithoutReference(foreignProblem));
    }

    private static string WithoutReference(JsonElement problem) =>
        string.Join("|", problem.EnumerateObject().Where(p => p.Name != "reference").Select(p => $"{p.Name}={p.Value.GetRawText()}"));

    // Note: same JSON value, ignoring the order of object keys (jsonb does not keep it); array order matters
    private static bool SameJson(JsonElement a, JsonElement b)
    {
        if (a.ValueKind != b.ValueKind)
        {
            return false;
        }
        return a.ValueKind switch
        {
            JsonValueKind.Object => a.EnumerateObject().Count() == b.EnumerateObject().Count()
                && a.EnumerateObject().All(property => b.TryGetProperty(property.Name, out var other) && SameJson(property.Value, other)),
            JsonValueKind.Array => a.GetArrayLength() == b.GetArrayLength()
                && a.EnumerateArray().Zip(b.EnumerateArray()).All(pair => SameJson(pair.First, pair.Second)),
            JsonValueKind.String => a.GetString() == b.GetString(),
            JsonValueKind.Number => a.GetDecimal() == b.GetDecimal(),
            _ => true,
        };
    }

    private sealed class ScopedDatabase : IAsyncDisposable
    {
        private readonly IServiceScope _scope;

        public ScopedDatabase(JodWebFactory factory)
        {
            _scope = factory.Services.CreateScope();
            Context = _scope.ServiceProvider.GetRequiredService<JodDbContext>();
        }

        public JodDbContext Context { get; }

        public ValueTask DisposeAsync()
        {
            _scope.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
