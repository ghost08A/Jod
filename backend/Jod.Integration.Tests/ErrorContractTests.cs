using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;

namespace Jod.Integration.Tests;

public class ErrorContractTests : IClassFixture<JodWebFactory>
{
    private const string ReferencePattern = "^[A-HJ-NP-Z2-9]{8}$";

    private readonly JodWebFactory _factory;
    private readonly HttpClient _client;

    public ErrorContractTests(JodWebFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task BusinessError_ReturnsProblemWithMessagesAndReference()
    {
        // Act
        var response = await _client.GetAsync("/api/test-errors/business-error");

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal(["ข้อความทดสอบข้อที่ 1", "ข้อความทดสอบข้อที่ 2"], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("title").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("detail").GetString()));
    }

    [Fact]
    public async Task InvalidModel_ReturnsProblemWithFixedThaiMessage()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/test-errors/validate", new { });

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal(["ข้อมูลที่ส่งมาไม่ถูกต้อง"], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
    }

    [Fact]
    public async Task MalformedJson_ReturnsFixedThaiMessageWithoutFrameworkText()
    {
        // Arrange
        var body = new StringContent("{not json", Encoding.UTF8, "application/json");

        // Act
        var response = await _client.PostAsync("/api/test-errors/validate", body);

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal(["ข้อมูลที่ส่งมาไม่ถูกต้อง"], ReadErrors(problem));
        Assert.DoesNotContain("invalid", problem.GetRawText());
    }

    [Fact]
    public async Task UnexpectedError_ReturnsGenericProblemWithoutInternalDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/test-errors/unexpected-error");

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.InternalServerError);
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        Assert.False(problem.TryGetProperty("errors", out _));
        var body = problem.GetRawText();
        Assert.DoesNotContain(TestErrorController.UnexpectedErrorMessage, body);
        Assert.DoesNotContain("InvalidOperationException", body);
        Assert.DoesNotContain("TestErrorController", body);
        Assert.DoesNotContain(" at ", body);
    }

    [Fact]
    public async Task Responses_HaveDifferentReferences()
    {
        // Act
        var references = new HashSet<string>();
        for (var i = 0; i < 25; i++)
        {
            var response = await _client.GetAsync("/api/test-errors/business-error");
            var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
            references.Add(problem.GetProperty("reference").GetString()!);
        }

        // Assert
        Assert.Equal(25, references.Count);
    }

    [Fact]
    public async Task Reference_MatchesTheLogLineWithErrorTypeAndEndpoint()
    {
        // Act
        var unexpected = await ReadProblemAsync(
            await _client.GetAsync("/api/test-errors/unexpected-error"), HttpStatusCode.InternalServerError);
        var business = await ReadProblemAsync(
            await _client.GetAsync("/api/test-errors/business-error"), HttpStatusCode.BadRequest);

        // Assert
        var unexpectedLog = LogLineFor(unexpected);
        Assert.Contains("System.InvalidOperationException", unexpectedLog);
        Assert.Contains("GET api/test-errors/unexpected-error", unexpectedLog);
        var businessLog = LogLineFor(business);
        Assert.Contains("CustomError", businessLog);
        Assert.Contains("GET api/test-errors/business-error", businessLog);
    }

    [Fact]
    public async Task Logs_DoNotContainRequestContentHeadersOrExceptionMessages()
    {
        // Arrange
        const string tokenMarker = "bearer-token-marker-4821";
        const string emailMarker = "someone-marker-4821@example.com";
        const string passwordMarker = "password-marker-4821";
        const string queryMarker = "query-marker-4821";
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/test-errors/validate?search={queryMarker}")
        {
            Content = JsonContent.Create(new { email = emailMarker, password = passwordMarker }),
        };
        request.Headers.Add("Authorization", $"Bearer {tokenMarker}");

        // Act
        await _client.SendAsync(request);
        await _client.GetAsync("/api/test-errors/unexpected-error");

        // Assert
        var everythingLogged = string.Join("\n", _factory.LogEntries.Select(e => $"{e.Message}\n{e.ExceptionText}"));
        Assert.DoesNotContain(tokenMarker, everythingLogged);
        Assert.DoesNotContain(emailMarker, everythingLogged);
        Assert.DoesNotContain(passwordMarker, everythingLogged);
        Assert.DoesNotContain(queryMarker, everythingLogged);
        Assert.DoesNotContain(TestErrorController.UnexpectedErrorMessage, everythingLogged);
    }

    [Theory]
    [InlineData("GET", "/api/does-not-exist", HttpStatusCode.NotFound)]
    [InlineData("POST", "/api/test-errors/business-error", HttpStatusCode.MethodNotAllowed)]
    public async Task EmptyFrameworkAnswers_BecomeProblems(string method, string path, HttpStatusCode expected)
    {
        // Arrange
        // Note: signed in, because without a token every path (even a missing one) answers 401
        var signedIn = await SignedInClientAsync();

        // Act
        var response = await signedIn.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        // Assert
        var problem = await ReadProblemAsync(response, expected);
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        Assert.NotNull(LogLineFor(problem));
    }

    [Fact]
    public async Task Conflict_CarriesPayloadAndKeepsReferenceAndProblemShape()
    {
        // Act
        var response = await _client.GetAsync("/api/test-errors/conflict-with-payload");

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.Conflict);
        Assert.Equal(["ข้อมูลถูกแก้จากที่อื่นแล้ว"], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("title").GetString()));
        var payload = problem.GetProperty("payload");
        Assert.Equal(7, payload.GetProperty("version").GetInt32());
        Assert.Equal(TestErrorController.ConflictPayloadMarker, payload.GetProperty("title").GetString());
        Assert.NotNull(LogLineFor(problem));
    }

    [Fact]
    public async Task Conflict_PayloadIsNeverWrittenToTheLog()
    {
        // Act
        await _client.GetAsync("/api/test-errors/conflict-with-payload");

        // Assert
        var everythingLogged = string.Join("\n", _factory.LogEntries.Select(e => $"{e.Message}\n{e.ExceptionText}"));
        Assert.DoesNotContain(TestErrorController.ConflictPayloadMarker, everythingLogged);
    }

    [Fact]
    public async Task OtherErrors_HaveNoPayloadMember()
    {
        // Act
        var conflict = await ReadProblemAsync(
            await _client.GetAsync("/api/test-errors/conflict-without-payload"), HttpStatusCode.Conflict);
        var business = await ReadProblemAsync(
            await _client.GetAsync("/api/test-errors/business-error"), HttpStatusCode.BadRequest);
        var unexpected = await ReadProblemAsync(
            await _client.GetAsync("/api/test-errors/unexpected-error"), HttpStatusCode.InternalServerError);

        // Assert
        Assert.False(conflict.TryGetProperty("payload", out _));
        Assert.False(business.TryGetProperty("payload", out _));
        Assert.False(unexpected.TryGetProperty("payload", out _));
        Assert.Equal(
            ["detail", "errors", "reference", "status", "title"],
            business.EnumerateObject().Select(p => p.Name).Order().ToArray());
    }

    [Fact]
    public async Task BlocksNested100Levels_AreAccepted()
    {
        // Act
        var response = await _client.PostAsync("/api/test-errors/blocks", NestedBlocks(100));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task BlocksNested101Levels_AreRejectedWhenJsonDepthIsSetToThe100LevelLimit()
    {
        // Arrange
        // Note: 100 block levels = 202 JSON levels in this request shape (object, array, then 2 per block)
        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Limits:JsonMaxDepth"] = "202" })))
            .CreateClient();

        // Act
        var accepted = await client.PostAsync("/api/test-errors/blocks", NestedBlocks(100));
        var rejected = await client.PostAsync("/api/test-errors/blocks", NestedBlocks(101));

        // Assert
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var problem = await ReadProblemAsync(rejected, HttpStatusCode.BadRequest);
        Assert.Equal(["ข้อมูลที่ส่งมาไม่ถูกต้อง"], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
    }

    [Fact]
    public async Task JsonDeeperThanTheDepthLimit_IsRejectedWithThaiMessageAndReference()
    {
        // Act
        var response = await _client.PostAsync("/api/test-errors/blocks", NestedBlocks(300));

        // Assert
        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal(["ข้อมูลที่ส่งมาไม่ถูกต้อง"], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
    }

    [Fact]
    public async Task BodyJustUnderTheLimit_IsAcceptedAndOverTheLimit_IsRejectedAsProblemJson()
    {
        // Arrange
        const int limit = 1_310_720;
        const int envelopeBytes = 11; // {"name":""}

        // Act
        var accepted = await _client.PostAsync("/api/test-errors/validate", NameBody(limit - envelopeBytes));
        var rejected = await _client.PostAsync("/api/test-errors/validate", NameBody(limit - envelopeBytes + 1));

        // Assert
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var problem = await ReadProblemAsync(rejected, HttpStatusCode.RequestEntityTooLarge);
        Assert.Equal(["ข้อมูลที่ส่งมามีขนาดใหญ่เกินกำหนด"], ReadErrors(problem));
        Assert.Matches(ReferencePattern, problem.GetProperty("reference").GetString());
        Assert.NotNull(LogLineFor(problem));
    }

    private static StringContent NestedBlocks(int levels)
    {
        var json = $"{{\"blocks\":[{string.Concat(Enumerable.Repeat("{\"children\":[", levels))}"
            + $"{string.Concat(Enumerable.Repeat("]}", levels))}]}}";
        return new StringContent(json, Encoding.UTF8, "application/json");
    }

    private static string NameJson(int nameLength) => $"{{\"name\":\"{new string('a', nameLength)}\"}}";

    private static StringContent NameBody(int nameLength) =>
        new(NameJson(nameLength), Encoding.UTF8, "application/json");

    private async Task<HttpClient> SignedInClientAsync()
    {
        var token = await TestGoogle.SignInAndGetAccessTokenAsync(_client);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }

    private static async Task<JsonElement> ReadProblemAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = (await response.Content.ReadFromJsonAsync<JsonElement>());
        Assert.Equal((int)expected, problem.GetProperty("status").GetInt32());
        return problem;
    }

    private static string[] ReadErrors(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateArray().Select(error => error.GetString()!).ToArray();

    private string LogLineFor(JsonElement problem)
    {
        var reference = problem.GetProperty("reference").GetString()!;
        return Assert.Single(_factory.LogEntries, entry => entry.Message.Contains(reference)).Message;
    }
}
