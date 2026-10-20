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
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Jod.Integration.Tests;

public class AuthApiTests : IClassFixture<JodWebFactory>
{
    private const string Password = "a-long-enough-password";
    private const string DuplicateEmailMessage = "อีเมลนี้มีบัญชีแล้ว";
    private const string InvalidLoginMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

    private readonly JodWebFactory _factory;
    private readonly HttpClient _client;
    private readonly JwtOptions _jwt;

    public AuthApiTests(JodWebFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _jwt = factory.Services.GetRequiredService<IOptions<JwtOptions>>().Value;
    }

    // ---- register ----

    [Fact]
    public async Task Register_ReturnsTokenAndUser_AndStoresOnlyAHashOfThePassword()
    {
        // Arrange
        var email = NewEmail();

        // Act
        var response = await Register(email, Password);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var user = body.GetProperty("user");
        Assert.Equal(email, user.GetProperty("email").GetString());
        Assert.False(user.GetProperty("emailConfirmed").GetBoolean());
        Assert.Equal(15 * 60, body.GetProperty("expiresInSeconds").GetInt32());

        var token = new JsonWebTokenHandler().ReadJsonWebToken(body.GetProperty("accessToken").GetString());
        Assert.Equal(user.GetProperty("id").GetString(), token.Subject);
        Assert.Equal("jod", token.Issuer);
        Assert.Equal("jod-web", Assert.Single(token.Audiences));
        Assert.Equal(SecurityAlgorithms.HmacSha256, token.Alg);
        Assert.False(string.IsNullOrEmpty(token.Id));
        Assert.Equal(TimeSpan.FromMinutes(15), token.ValidTo - token.IssuedAt);
        Assert.False(token.TryGetPayloadValue<string>("email", out _));

        using var scope = _factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<JodDbContext>()
            .Users.AsNoTracking().SingleAsync(u => u.Email == email);
        Assert.False(string.IsNullOrEmpty(stored.PasswordHash));
        Assert.DoesNotContain(Password, stored.PasswordHash);
    }

    [Theory]
    [InlineData("UPPER")]
    [InlineData("  padded  ")]
    public async Task Register_WithTheSameEmailInADifferentForm_ReturnsConflict(string form)
    {
        // Arrange
        var email = NewEmail();
        await Register(email, Password);
        var variant = form == "UPPER" ? email.ToUpperInvariant() : $"  {email}  ";

        // Act
        var response = await Register(variant, Password);

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.Conflict);
        Assert.Equal([DuplicateEmailMessage], ReadErrors(problem));
        Assert.False(string.IsNullOrEmpty(problem.GetProperty("reference").GetString()));
    }

    [Theory]
    [InlineData(9, HttpStatusCode.BadRequest)]
    [InlineData(10, HttpStatusCode.Created)]
    [InlineData(128, HttpStatusCode.Created)]
    [InlineData(129, HttpStatusCode.BadRequest)]
    public async Task Register_PasswordLengthLimits(int length, HttpStatusCode expected)
    {
        // Act
        var response = await Register(NewEmail(), new string('x', length));

        // Assert
        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.BadRequest)
        {
            var problem = await ReadProblem(response, expected);
            var message = Assert.Single(ReadErrors(problem));
            Assert.Contains(length < 10 ? "อย่างน้อย 10" : "ไม่เกิน 128", message);
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-an-email")]
    public async Task Register_WithInvalidEmail_ReturnsBadRequest(string email)
    {
        // Act
        var response = await Register(email, Password);

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(["รูปแบบอีเมลไม่ถูกต้อง"], ReadErrors(problem));
    }

    [Fact]
    public async Task Register_SameEmailAtTheSameTime_CreatesOneAccountAndTheRestGetConflict()
    {
        // Arrange
        var email = NewEmail();

        // Act
        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Register(email, Password)));

        // Assert
        var statuses = responses.Select(r => r.StatusCode).ToList();
        Assert.Single(statuses, HttpStatusCode.Created);
        Assert.Equal(3, statuses.Count(s => s == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Register_WhenRegistrationIsClosed_ReturnsForbiddenAndCreatesNothing()
    {
        // Arrange
        using var closed = _factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Registration:Mode"] = "Closed" })));
        var email = NewEmail();

        // Act
        var response = await closed.CreateClient().PostAsJsonAsync("/api/auth/register", new { email, password = Password });

        // Assert
        var problem = await ReadProblem(response, HttpStatusCode.Forbidden);
        Assert.Equal(["การสมัครสมาชิกปิดอยู่ในขณะนี้"], ReadErrors(problem));
        using var scope = _factory.Services.CreateScope();
        Assert.False(await scope.ServiceProvider.GetRequiredService<JodDbContext>().Users.AnyAsync(u => u.Email == email));
    }

    // ---- login ----

    [Fact]
    public async Task Login_WithCorrectCredentials_ReturnsTokenAndUser()
    {
        // Arrange
        var email = NewEmail();
        await Register(email, Password);

        // Act
        var response = await Login($"  {email.ToUpperInvariant()}  ", Password);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, body.GetProperty("user").GetProperty("email").GetString());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("accessToken").GetString()));
    }

    [Fact]
    public async Task Login_WithWrongPasswordOrUnknownEmail_ReturnsTheSameUnauthorizedMessage()
    {
        // Arrange
        var email = NewEmail();
        await Register(email, Password);

        // Act
        var wrongPassword = await ReadProblem(await Login(email, "not-the-password"), HttpStatusCode.Unauthorized);
        var unknownEmail = await ReadProblem(await Login(NewEmail(), Password), HttpStatusCode.Unauthorized);

        // Assert
        Assert.Equal([InvalidLoginMessage], ReadErrors(wrongPassword));
        Assert.Equal(ReadErrors(wrongPassword), ReadErrors(unknownEmail));
        Assert.Equal(wrongPassword.GetProperty("detail").GetString(), unknownEmail.GetProperty("detail").GetString());
    }

    // ---- GET /api/me and sign-in by default ----

    [Fact]
    public async Task Me_WithAValidToken_ReturnsTheUser()
    {
        // Arrange
        var email = NewEmail();
        var registered = await (await Register(email, Password)).Content.ReadFromJsonAsync<JsonElement>();

        // Act
        var response = await GetWithToken("/api/me", registered.GetProperty("accessToken").GetString());

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.Equal(registered.GetProperty("user").GetProperty("id").GetString(), me.GetProperty("id").GetString());
        Assert.False(me.GetProperty("emailConfirmed").GetBoolean());
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
        var userId = await RegisterAndGetUserId();
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
        var registered = await (await Register(NewEmail(), Password)).Content.ReadFromJsonAsync<JsonElement>();

        // Act
        var withoutToken = await _client.GetAsync("/api/test-probe");
        var withToken = await GetWithToken("/api/test-probe", registered.GetProperty("accessToken").GetString());

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, withoutToken.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withToken.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/does-not-exist")]
    [InlineData("POST", "/api/me")]
    public async Task AnonymousCallsToUnknownRoutesOrWrongMethods_GetUnauthorizedNotNotFound(string method, string path)
    {
        // Act
        var response = await _client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        // Assert
        await ReadProblem(response, HttpStatusCode.Unauthorized);
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

    [Fact]
    public void RegistrationIsClosedByDefault()
    {
        Assert.Equal(RegistrationMode.Closed, new RegistrationOptions().Mode);
    }

    // ---- logs ----

    [Fact]
    public async Task Logs_DoNotContainPasswordsEmailsOrTokens()
    {
        // Arrange
        var email = $"log-marker-{Guid.NewGuid():N}@example.com";
        const string passwordMarker = "log-password-marker-7731";

        // Act
        var registered = await (await Register(email, passwordMarker)).Content.ReadFromJsonAsync<JsonElement>();
        await Login(email, passwordMarker);
        await Login(email, "wrong-log-password-marker-7731");
        await Register(email, passwordMarker);
        await GetWithToken("/api/me", registered.GetProperty("accessToken").GetString());

        // Assert
        var everythingLogged = string.Join("\n", _factory.LogEntries.Select(e => $"{e.Message}\n{e.ExceptionText}"));
        Assert.DoesNotContain("log-password-marker-7731", everythingLogged);
        Assert.DoesNotContain(email, everythingLogged, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(registered.GetProperty("accessToken").GetString()!, everythingLogged);
    }

    // ---- helpers ----

    private static string NewEmail() => $"{Guid.NewGuid():N}@example.com";

    private Task<HttpResponseMessage> Register(string email, string password) =>
        _client.PostAsJsonAsync("/api/auth/register", new { email, password });

    private Task<HttpResponseMessage> Login(string email, string password) =>
        _client.PostAsJsonAsync("/api/auth/login", new { email, password });

    private async Task<Guid> RegisterAndGetUserId()
    {
        var body = await (await Register(NewEmail(), Password)).Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("user").GetProperty("id").GetGuid();
    }

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
