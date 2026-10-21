using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Jod.Service.Data;
using Jod.Service.Options;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jod.Integration.Tests;

public class RefreshTokenTests : IClassFixture<JodWebFactory>
{
    private const string CookieName = "jod_refresh";

    private readonly JodWebFactory _factory;

    // Note: cookies are handled by hand so the tests can read every attribute of Set-Cookie
    private readonly HttpClient _client;

    public RefreshTokenTests(JodWebFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    // ---- cookie and storage ----

    [Theory]
    [InlineData("first")]
    [InlineData("again")]
    public async Task SignIn_SetsTheRefreshCookieWithTheAgreedAttributes(string visit)
    {
        // Arrange
        var email = NewEmail();
        var firstVisit = await SignIn(email);

        // Act
        var response = visit == "first" ? firstVisit : await SignIn(email);

        // Assert
        var cookie = ReadSetCookie(response);
        Assert.Equal(CookieName, cookie.Name);
        Assert.False(string.IsNullOrEmpty(cookie.Value));
        Assert.Contains("httponly", cookie.Attributes);
        Assert.Contains("samesite=strict", cookie.Attributes);
        Assert.Contains("path=/api/auth", cookie.Attributes);
        Assert.Contains("secure", cookie.Attributes);
        var expires = DateTimeOffset.Parse(cookie.Attributes.Single(a => a.StartsWith("expires=")).Replace("expires=", ""));
        Assert.InRange(expires - DateTimeOffset.UtcNow, TimeSpan.FromDays(29.9), TimeSpan.FromDays(30.1));
    }

    [Fact]
    public async Task TheRefreshCookieIsNotSecureOnPlainHttpInDevelopmentOnly()
    {
        // Arrange
        using var development = _factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        var client = development.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        // Act
        var response = await TestGoogle.SignInAsync(client);

        // Assert
        Assert.DoesNotContain("secure", ReadSetCookie(response).Attributes);
    }

    [Fact]
    public async Task TheDatabaseStoresOnlyTheHashOfTheRefreshToken()
    {
        // Arrange
        var response = await SignIn(NewEmail());
        var rawToken = ReadSetCookie(response).Value;

        // Act
        var rows = await ReadTokenRowsAsync();

        // Assert
        var row = Assert.Single(rows, r => r.TokenHash.SequenceEqual(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))));
        Assert.Equal(32, row.TokenHash.Length);
        Assert.DoesNotContain(rows, r => Encoding.UTF8.GetString(r.TokenHash).Contains(rawToken));
    }

    [Fact]
    public async Task TheRefreshTokenNeverAppearsInAResponseBody()
    {
        // Act
        var response = await SignIn(NewEmail());
        var rawToken = ReadSetCookie(response).Value;

        // Assert
        Assert.DoesNotContain(rawToken, await response.Content.ReadAsStringAsync());
    }

    // ---- refresh ----

    [Fact]
    public async Task Refresh_GivesANewAccessTokenAndANewCookie_AndTheOldTokenCannotBeUsedAgain()
    {
        // Arrange
        var first = ReadSetCookie(await SignIn(NewEmail()));

        // Act
        var refreshed = await Refresh(first.Value);
        var replay = await Refresh(first.Value);

        // Assert
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var body = await refreshed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("accessToken").GetString()));
        Assert.Equal(900, body.GetProperty("expiresInSeconds").GetInt32());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("user").GetProperty("email").GetString()));
        var second = ReadSetCookie(refreshed);
        Assert.NotEqual(first.Value, second.Value);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
    }

    [Fact]
    public async Task Refresh_ReturnsAnAccessTokenThatWorks()
    {
        // Arrange
        var first = ReadSetCookie(await SignIn(NewEmail()));

        // Act
        var refreshed = await (await Refresh(first.Value)).Content.ReadFromJsonAsync<JsonElement>();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Authorization = new("Bearer", refreshed.GetProperty("accessToken").GetString());
        var me = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task ReusingAnOldToken_RevokesTheWholeFamily_IncludingTheNewestToken()
    {
        // Arrange
        var first = ReadSetCookie(await SignIn(NewEmail()));
        var second = ReadSetCookie(await Refresh(first.Value));

        // Act
        var replayOfFirst = await Refresh(first.Value);
        var newestAfterReplay = await Refresh(second.Value);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, replayOfFirst.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, newestAfterReplay.StatusCode);
    }

    [Fact]
    public async Task TwoRefreshesAtTheSameTimeWithOneToken_OneWins_AndTheFamilyIsRevoked()
    {
        // Arrange
        var first = ReadSetCookie(await SignIn(NewEmail()));

        // Act
        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => Refresh(first.Value)));

        // Assert
        var winner = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Unauthorized);
        var newest = ReadSetCookie(winner);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(newest.Value)).StatusCode);
    }

    [Fact]
    public async Task ARefreshTokenOlderThanThirtyDays_IsRejected()
    {
        // Arrange
        var token = ReadSetCookie(await SignIn(NewEmail())).Value;
        // Note: "thirty days later" is simulated by moving the token's expiry into the past
        await ExpireTokenAsync(token);

        // Act
        var response = await Refresh(token);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-real-token")]
    public async Task Refresh_WithoutAValidCookie_ReturnsUnauthorizedProblem(string? cookieValue)
    {
        // Act
        var response = await Refresh(cookieValue);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    // ---- the closed group is checked again at every renewal ----

    [Fact]
    public async Task Refresh_AfterTheEmailLeavesTheAllowedList_IsRejected_AndTheFamilyStaysRevoked()
    {
        // Arrange
        var email = NewEmail();
        var phone = ReadSetCookie(await SignIn(email)).Value;
        var laptop = ReadSetCookie(await SignIn(email)).Value;
        AllowedEmails().Remove(email);

        try
        {
            // Act
            var whileRemoved = await Refresh(phone);
            AllowedEmails().Add(email);
            var afterBeingAddedBack = await Refresh(phone);
            var otherDevice = await Refresh(laptop);

            // Assert
            Assert.Equal(HttpStatusCode.Unauthorized, whileRemoved.StatusCode);
            // Note: still rejected after the email is back, so the family was revoked and not just refused once
            Assert.Equal(HttpStatusCode.Unauthorized, afterBeingAddedBack.StatusCode);
            // Note: the other device's family is only revoked when that device renews while the email is off the list
            Assert.Equal(HttpStatusCode.OK, otherDevice.StatusCode);
        }
        finally
        {
            if (!AllowedEmails().Contains(email))
            {
                AllowedEmails().Add(email);
            }
        }
    }

    // ---- logout ----

    [Fact]
    public async Task Logout_RevokesTheTokenAndClearsTheCookie_AndCanBeRepeated()
    {
        // Arrange
        var token = ReadSetCookie(await SignIn(NewEmail())).Value;

        // Act
        var logout = await Logout(token);
        var refreshAfterLogout = await Refresh(token);
        var logoutAgain = await Logout(token);
        var logoutWithoutCookie = await Logout(null);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        var cleared = ReadSetCookie(logout);
        Assert.Equal(CookieName, cleared.Name);
        Assert.True(cleared.Value == "" || cleared.Attributes.Contains("max-age=0")
            || DateTimeOffset.Parse(cleared.Attributes.Single(a => a.StartsWith("expires=")).Replace("expires=", "")) < DateTimeOffset.UtcNow);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshAfterLogout.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, logoutAgain.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, logoutWithoutCookie.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesOnlyTheFamilyOfThatDevice()
    {
        // Arrange
        var email = NewEmail();
        var phone = ReadSetCookie(await SignIn(email)).Value;
        var laptop = ReadSetCookie(await SignIn(email)).Value;

        // Act
        await Logout(phone);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(phone)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(laptop)).StatusCode);
    }

    // ---- the header that blocks forged requests ----

    [Theory]
    [InlineData("refresh", null)]
    [InlineData("refresh", "something-else")]
    [InlineData("logout", null)]
    [InlineData("logout", "something-else")]
    public async Task RefreshAndLogout_WithoutTheRequestedWithHeader_AreForbidden(string action, string? headerValue)
    {
        // Arrange
        var token = ReadSetCookie(await SignIn(NewEmail())).Value;
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/auth/{action}");
        request.Headers.Add("Cookie", $"{CookieName}={token}");
        if (headerValue is not null)
        {
            request.Headers.Add("X-Requested-With", headerValue);
        }

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(token)).StatusCode);
    }

    // ---- logs ----

    [Fact]
    public async Task Logs_DoNotContainRefreshTokens()
    {
        // Arrange
        var first = ReadSetCookie(await SignIn(NewEmail())).Value;

        // Act
        var second = ReadSetCookie(await Refresh(first)).Value;
        await Refresh(first);
        await Logout(second);
        await Refresh("garbage-refresh-token-marker-5521");

        // Assert
        var everythingLogged = string.Join("\n", _factory.LogEntries.Select(e => $"{e.Message}\n{e.ExceptionText}"));
        Assert.DoesNotContain(first, everythingLogged);
        Assert.DoesNotContain(second, everythingLogged);
        Assert.DoesNotContain("garbage-refresh-token-marker-5521", everythingLogged);
    }

    // ---- helpers ----

    private static string NewEmail() => TestGoogle.NewEmail();

    private Task<HttpResponseMessage> SignIn(string email) => TestGoogle.SignInAsync(_client, email);

    private List<string> AllowedEmails() =>
        _factory.Services.GetRequiredService<IOptions<AccessOptions>>().Value.AllowedEmails;

    private Task<HttpResponseMessage> Refresh(string? cookieValue) => PostWithCookie("refresh", cookieValue);

    private Task<HttpResponseMessage> Logout(string? cookieValue) => PostWithCookie("logout", cookieValue);

    private Task<HttpResponseMessage> PostWithCookie(string action, string? cookieValue)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/auth/{action}");
        request.Headers.Add("X-Requested-With", "jod");
        if (cookieValue is not null)
        {
            request.Headers.Add("Cookie", $"{CookieName}={cookieValue}");
        }
        return _client.SendAsync(request);
    }

    private record SetCookie(string Name, string Value, string[] Attributes);

    private static SetCookie ReadSetCookie(HttpResponseMessage response)
    {
        var header = response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith($"{CookieName}="));
        var parts = header.Split(';', StringSplitOptions.TrimEntries);
        var nameAndValue = parts[0].Split('=', 2);
        return new SetCookie(nameAndValue[0], nameAndValue[1], parts.Skip(1).Select(p => p.ToLowerInvariant()).ToArray());
    }

    private async Task<List<RefreshToken>> ReadTokenRowsAsync()
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<JodDbContext>().RefreshTokens.AsNoTracking().ToListAsync();
    }

    private async Task ExpireTokenAsync(string rawToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<JodDbContext>();
        var row = await context.RefreshTokens.SingleAsync(t => t.TokenHash == hash);
        row.ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1);
        await context.SaveChangesAsync();
    }
}
