using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Jod.Service.Data;
using Jod.Service.Options;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Jod.Integration.Tests;

public class AuthApiTests : IClassFixture<JodWebFactory>
{
    private const string GoogleFailedMessage = "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง";
    private const string NotAllowedMessage = "บัญชี Google นี้ยังไม่ได้รับอนุญาตให้ใช้ Jod ติดต่อผู้ดูแล";
    private const string UntrustedAccountMessage =
        "บัญชี Google นี้ใช้เข้า Jod ไม่ได้ (อีเมลยังไม่ได้รับการยืนยันจาก Google หรือไม่ใช่ Gmail/บัญชีองค์กร)";
    private const string GoogleUnreachableMessage = "ตรวจสอบกับ Google ไม่ได้ชั่วคราว ลองอีกครั้ง";

    private readonly JodWebFactory _factory;
    private readonly HttpClient _client;
    private readonly JwtOptions _jwt;

    public AuthApiTests(JodWebFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _jwt = factory.Services.GetRequiredService<IOptions<JwtOptions>>().Value;
    }

    // ---- POST /api/auth/google: success ----

    [Fact]
    public async Task SignIn_ReturnsTokenAndUser_AndCreatesOneUserWithTheGoogleSubject()
    {
        // Arrange
        var email = NewEmail();

        // Act
        var response = await TestGoogle.SignInAsync(_client, email);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var user = body.GetProperty("user");
        Assert.Equal(email, user.GetProperty("email").GetString());
        Assert.Equal(["id", "email"], user.EnumerateObject().Select(property => property.Name));
        Assert.Equal(15 * 60, body.GetProperty("expiresInSeconds").GetInt32());

        var token = new JsonWebTokenHandler().ReadJsonWebToken(body.GetProperty("accessToken").GetString());
        Assert.Equal(user.GetProperty("id").GetString(), token.Subject);
        Assert.Equal("jod", token.Issuer);
        Assert.Equal("jod-web", Assert.Single(token.Audiences));
        Assert.Equal(SecurityAlgorithms.HmacSha256, token.Alg);
        Assert.False(string.IsNullOrEmpty(token.Id));
        Assert.Equal(TimeSpan.FromMinutes(15), token.ValidTo - token.IssuedAt);
        Assert.False(token.TryGetPayloadValue<string>("email", out _));

        var row = await ReadUserBySubject(TestGoogle.SubjectFor(email));
        Assert.Equal(email, row.Email);
        Assert.Equal(user.GetProperty("id").GetGuid(), row.Id);
        // Note: the Jod user id is its own value, not the Google subject
        Assert.NotEqual(row.GoogleSubject, token.Subject);
    }

    [Fact]
    public async Task SignIn_AgainWithTheSameSubject_ReturnsTheSameUser_AndUpdatesTheEmail()
    {
        // Arrange
        var subject = TestGoogle.SubjectFor(NewEmail());
        var oldEmail = NewEmail();
        var newEmail = NewEmail();
        var first = await ReadBody(await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(oldEmail, subject)));

        // Act
        var second = await ReadBody(await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(newEmail, subject)));

        // Assert
        Assert.Equal(first.GetProperty("user").GetProperty("id").GetGuid(), second.GetProperty("user").GetProperty("id").GetGuid());
        Assert.Equal(newEmail, second.GetProperty("user").GetProperty("email").GetString());
        Assert.Equal(newEmail, (await ReadUserBySubject(subject)).Email);
        Assert.Equal(1, await CountUsersBySubject(subject));
    }

    [Fact]
    public async Task SignIn_ManyFirstSignInsAtTheSameTime_CreateOneUser()
    {
        // Arrange
        var email = NewEmail();

        // Act
        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => TestGoogle.SignInAsync(_client, email)));

        // Assert
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        var ids = await Task.WhenAll(responses.Select(async r => (await ReadBody(r)).GetProperty("user").GetProperty("id").GetGuid()));
        Assert.Single(ids.Distinct());
        Assert.Equal(1, await CountUsersBySubject(TestGoogle.SubjectFor(email)));
    }

    [Fact]
    public async Task SignIn_IgnoresIdentityFieldsSentOutsideTheCredential()
    {
        // Arrange
        var email = NewEmail();
        var body = new
        {
            credential = TestGoogle.Credential(email),
            email = "forged@gmail.com",
            sub = "forged-subject",
            userId = Guid.NewGuid(),
            emailVerified = true,
        };

        // Act
        var response = await TestGoogle.SendAsync(_client, body);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(email, (await ReadBody(response)).GetProperty("user").GetProperty("email").GetString());
        Assert.Equal(0, await CountUsersBySubject("forged-subject"));
    }

    [Fact]
    public async Task SignIn_WithAWorkspaceAccountThatIsNotGmail_Works()
    {
        // Arrange
        var email = $"person-{Guid.NewGuid():N}@company.example";
        using var _ = AllowTemporarily(email);

        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(email, hostedDomain: "company.example"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SignIn_CaseAndSurroundingSpacesInTheEmailDoNotMatter()
    {
        // Arrange
        var email = NewEmail();
        var credential = TestGoogle.Credential($"  {email.ToUpperInvariant()} ".Replace("@GMAIL.COM", "@Gmail.com"));

        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, credential);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ---- POST /api/auth/google: refused ----

    [Theory]
    [InlineData(TestGoogle.InvalidCredential)]
    [InlineData("{\"sub\":\"only-a-subject\"}")]
    public async Task SignIn_WithATokenThatCannotBeUsed_ReturnsUnauthorized_AndCreatesNothing(string credential)
    {
        // Arrange
        var usersBefore = await CountAllUsers();

        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, credential);

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.Unauthorized);
        Assert.Equal([GoogleFailedMessage], ReadErrors(problem));
        Assert.Equal(usersBefore, await CountAllUsers());
    }

    [Theory]
    [InlineData("""{}""")]
    [InlineData("""{"credential":""}""")]
    [InlineData("""{"credential":"   "}""")]
    [InlineData("""{"credential":null}""")]
    public async Task SignIn_WithoutACredential_ReturnsBadRequest(string json)
    {
        // Arrange
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/google")
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("X-Requested-With", "jod");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        await ReadProblem(response, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SignIn_WithAnEmailGoogleHasNotVerified_ReturnsUnauthorized()
    {
        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(NewEmail(), emailVerified: false));

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.Unauthorized);
        Assert.Equal([UntrustedAccountMessage], ReadErrors(problem));
    }

    [Fact]
    public async Task SignIn_WithAnAddressThatIsNeitherGmailNorWorkspace_ReturnsUnauthorized()
    {
        // Arrange
        var email = $"person-{Guid.NewGuid():N}@other-provider.example";
        using var _ = AllowTemporarily(email);

        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(email));

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.Unauthorized);
        Assert.Equal([UntrustedAccountMessage], ReadErrors(problem));
    }

    [Fact]
    public async Task SignIn_WithAnEmailThatIsNotOnTheList_ReturnsForbidden_AndCreatesNothing()
    {
        // Arrange
        var email = $"stranger-{Guid.NewGuid():N}@gmail.com";

        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(email));

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.Forbidden);
        Assert.Equal([NotAllowedMessage], ReadErrors(problem));
        Assert.Equal(0, await CountUsersBySubject(TestGoogle.SubjectFor(email)));
    }

    [Fact]
    public async Task SignIn_WithAnEmptyList_LetsNobodyIn()
    {
        // Arrange
        using var emptyList = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.PostConfigure<AccessOptions>(access => access.AllowedEmails.Clear())));
        var client = emptyList.CreateClient();

        // Act
        var response = await TestGoogle.SignInAsync(client);

        // Assert
        await ReadProblem(response, HttpStatusCode.Forbidden);
        Assert.Contains(_factory.LogEntries, e => e.Level == LogLevel.Warning && e.Message.Contains("Access:AllowedEmails is empty"));
    }

    [Fact]
    public async Task SignIn_WithoutTheRequestedWithHeader_ReturnsForbidden_AndCreatesNothing()
    {
        // Arrange
        var email = NewEmail();

        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential(email), withRequestedWithHeader: false);

        // Assert
        await ReadProblem(response, HttpStatusCode.Forbidden);
        Assert.Equal(0, await CountUsersBySubject(TestGoogle.SubjectFor(email)));
    }

    [Fact]
    public async Task SignIn_WhenGoogleCannotBeReached_Returns503NotUnauthorized_WithAReference()
    {
        // Act
        var response = await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.GoogleUnreachable);

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.ServiceUnavailable);
        Assert.Equal([GoogleUnreachableMessage], ReadErrors(problem));
        Assert.Matches("^[A-HJ-NP-Z2-9]{8}$", problem.GetProperty("reference").GetString());
    }

    // ---- GET /api/me and sign-in by default ----

    [Fact]
    public async Task Me_WithAValidToken_ReturnsTheUser()
    {
        // Arrange
        var email = NewEmail();
        var signedIn = await ReadBody(await TestGoogle.SignInAsync(_client, email));

        // Act
        var response = await GetWithToken("/api/me", signedIn.GetProperty("accessToken").GetString());

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.Equal(signedIn.GetProperty("user").GetProperty("id").GetString(), me.GetProperty("id").GetString());
        Assert.Equal(["id", "email"], me.EnumerateObject().Select(property => property.Name));
    }

    [Fact]
    public async Task Me_WithoutAToken_ReturnsUnauthorizedProblem()
    {
        // Act
        var response = await _client.GetAsync("/api/me");

        // Assert
        await ReadProblem(response, HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_WithABadToken_ReturnsUnauthorized()
    {
        // Arrange
        var userId = await SignInAndGetUserId();
        var wrongKey = new SymmetricSecurityKey("a-completely-different-key-0123456789"u8.ToArray());
        var now = DateTime.UtcNow;
        var badTokens = new Dictionary<string, string>
        {
            ["garbage"] = "not-a-token",
            ["expired"] = MakeToken(_jwt.CreateSigningKey(), userId, "jod", "jod-web", now.AddHours(-1), now.AddMinutes(-30)),
            ["wrong signature"] = MakeToken(wrongKey, userId, "jod", "jod-web", now, now.AddMinutes(15)),
            ["wrong issuer"] = MakeToken(_jwt.CreateSigningKey(), userId, "someone-else", "jod-web", now, now.AddMinutes(15)),
            ["wrong audience"] = MakeToken(_jwt.CreateSigningKey(), userId, "jod", "someone-else", now, now.AddMinutes(15)),
            ["no signature (alg none)"] = new JsonWebTokenHandler().CreateToken(
                $$"""{"sub":"{{userId}}","iss":"jod","aud":"jod-web","exp":{{new DateTimeOffset(now.AddMinutes(15)).ToUnixTimeSeconds()}}}"""),
            ["user that does not exist"] = MakeToken(_jwt.CreateSigningKey(), Guid.NewGuid(), "jod", "jod-web", now, now.AddMinutes(15)),
        };

        foreach (var (name, token) in badTokens)
        {
            // Act
            var response = await GetWithToken("/api/me", token);

            // Assert
            Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"{name} should be rejected but got {response.StatusCode}");
        }
    }

    [Fact]
    public async Task AnEndpointWithoutAllowAnonymous_RequiresSignInAutomatically()
    {
        // Arrange
        var token = await TestGoogle.SignInAndGetAccessTokenAsync(_client);

        // Act
        var withoutToken = await _client.GetAsync("/api/test-probe");
        var withToken = await GetWithToken("/api/test-probe", token);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, withoutToken.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withToken.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/does-not-exist")]
    [InlineData("POST", "/api/me")]
    [InlineData("POST", "/api/auth/register")]
    [InlineData("POST", "/api/auth/login")]
    public async Task AnonymousCallsToUnknownRoutesOrWrongMethods_GetUnauthorizedNotNotFound(string method, string path)
    {
        // Act
        var response = await _client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        // Assert
        await ReadProblem(response, HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("/api/auth/register")]
    [InlineData("/api/auth/login")]
    public async Task ThePasswordEndpointsOfTheFirstBuild_NoLongerExist(string path)
    {
        // Arrange
        var token = await TestGoogle.SignInAndGetAccessTokenAsync(_client);
        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(new { email = "a@gmail.com", password = "x" }) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- startup checks ----

    [Theory]
    [InlineData("")]
    [InlineData("too-short-key")]
    [InlineData("REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_BYTES")]
    public async Task App_WithAMissingShortOrPlaceholderSigningKey_DoesNotStart(string signingKey)
    {
        // Arrange
        using var broken = _factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:SigningKey"] = signingKey })));

        // Act
        var exception = await Record.ExceptionAsync(() => Task.Run(() => broken.CreateClient()));

        // Assert
        Assert.Contains("Jwt:SigningKey", exception?.ToString() ?? "");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID")]
    public async Task App_WithAMissingOrPlaceholderGoogleClientId_DoesNotStart(string clientId)
    {
        // Arrange
        using var broken = _factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Google:ClientId"] = clientId })));

        // Act
        var exception = await Record.ExceptionAsync(() => Task.Run(() => broken.CreateClient()));

        // Assert
        Assert.Contains("Google:ClientId", exception?.ToString() ?? "");
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("two@@gmail.com")]
    public async Task App_WithAnInvalidEmailOnTheAllowedList_DoesNotStart(string badEntry)
    {
        // Arrange
        using var broken = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.PostConfigure<AccessOptions>(access => access.AllowedEmails.Add(badEntry))));

        // Act
        var exception = await Record.ExceptionAsync(() => Task.Run(() => broken.CreateClient()));

        // Assert
        Assert.Contains("Access:AllowedEmails", exception?.ToString() ?? "");
    }

    // ---- logs ----

    [Fact]
    public async Task Logs_DoNotContainGoogleCredentialsEmailsOrTokens()
    {
        // Arrange
        var email = $"log-marker-{Guid.NewGuid():N}@gmail.com";
        using var _ = AllowTemporarily(email);
        var credential = TestGoogle.Credential(email, subject: "log-subject-marker-9042");
        const string badCredential = "bad-credential-marker-6613";

        // Act
        var signedIn = await ReadBody(await TestGoogle.SignInWithCredentialAsync(_client, credential));
        await TestGoogle.SignInWithCredentialAsync(_client, badCredential);
        await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.GoogleUnreachable);
        await TestGoogle.SignInWithCredentialAsync(_client, TestGoogle.Credential($"stranger-{Guid.NewGuid():N}@gmail.com", "log-subject-marker-9043"));
        await GetWithToken("/api/me", signedIn.GetProperty("accessToken").GetString());

        // Assert
        var everythingLogged = string.Join("\n", _factory.LogEntries.Select(e => $"{e.Message}\n{e.ExceptionText}"));
        Assert.DoesNotContain(credential, everythingLogged);
        Assert.DoesNotContain("log-subject-marker", everythingLogged);
        Assert.DoesNotContain(badCredential, everythingLogged);
        Assert.DoesNotContain(email, everythingLogged, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(signedIn.GetProperty("accessToken").GetString()!, everythingLogged);
    }

    // ---- helpers ----

    private static string NewEmail() => TestGoogle.NewEmail();

    // Note: puts an email on the allowed list for the length of one test and takes it off afterwards
    private AllowedEmailScope AllowTemporarily(string email) => new(_factory.Services.GetRequiredService<IOptions<AccessOptions>>().Value, email);

    private sealed class AllowedEmailScope : IDisposable
    {
        private readonly AccessOptions _options;
        private readonly string _email;

        public AllowedEmailScope(AccessOptions options, string email)
        {
            _options = options;
            _email = email;
            _options.AllowedEmails.Add(email);
        }

        public void Dispose() => _options.AllowedEmails.Remove(_email);
    }

    private static async Task<JsonElement> ReadBody(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<AppUser> ReadUserBySubject(string subject)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<JodDbContext>()
            .Users.AsNoTracking().SingleAsync(u => u.GoogleSubject == subject);
    }

    private async Task<int> CountUsersBySubject(string subject)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<JodDbContext>().Users.CountAsync(u => u.GoogleSubject == subject);
    }

    private async Task<int> CountAllUsers()
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<JodDbContext>().Users.CountAsync();
    }

    private async Task<Guid> SignInAndGetUserId() =>
        (await ReadBody(await TestGoogle.SignInAsync(_client))).GetProperty("user").GetProperty("id").GetGuid();

    private Task<HttpResponseMessage> GetWithToken(string path, string? token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return _client.SendAsync(request);
    }

    private static string MakeToken(SecurityKey key, Guid userId, string issuer, string audience, DateTime issuedAt, DateTime expires) =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            NotBefore = issuedAt,
            IssuedAt = issuedAt,
            Expires = expires,
            Claims = new Dictionary<string, object> { ["sub"] = userId.ToString() },
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        });

    private static async Task<JsonElement> ReadProblem(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static string[] ReadErrors(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateArray().Select(error => error.GetString()!).ToArray();
}
