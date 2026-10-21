using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Jod.Integration.Tests;

public class RateLimitTests : IClassFixture<JodWebFactory>
{
    private readonly JodWebFactory _factory;

    public RateLimitTests(JodWebFactory factory) => _factory = factory;

    private const string SignInPath = "/api/auth/google";

    [Fact]
    public async Task EleventhRequestInAMinute_IsRejectedWithAProblemAndReference()
    {
        // Arrange
        using var limited = WithDefaultLimit();
        var client = limited.CreateClient();

        // Act
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 10; i++)
        {
            statuses.Add((await Post(client, SignInPath)).StatusCode);
        }
        var rejected = await Post(client, SignInPath);

        // Assert
        Assert.DoesNotContain(HttpStatusCode.TooManyRequests, statuses);
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.Equal("application/problem+json", rejected.Content.Headers.ContentType?.MediaType);
        var problem = await rejected.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(429, problem.GetProperty("status").GetInt32());
        Assert.Matches("^[A-HJ-NP-Z2-9]{8}$", problem.GetProperty("reference").GetString());
    }

    [Fact]
    public async Task AnotherIpAddress_IsNotAffected()
    {
        // Arrange
        using var limited = WithDefaultLimit();
        var client = limited.CreateClient();
        for (var i = 0; i < 11; i++)
        {
            await Post(client, SignInPath, ip: "10.0.0.1");
        }

        // Act
        var sameIp = await Post(client, SignInPath, ip: "10.0.0.1");
        var otherIp = await Post(client, SignInPath, ip: "10.0.0.2");

        // Assert
        Assert.Equal(HttpStatusCode.TooManyRequests, sameIp.StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, otherIp.StatusCode);
    }

    [Fact]
    public async Task AfterTheWindowPasses_RequestsAreAcceptedAgain()
    {
        // Arrange
        // Note: the window is a setting, so the test uses two seconds instead of waiting a real minute.
        // The requests are sent with an empty body (answered with 400 at once but still counted) so all 11 fit in one window
        using var limited = WithDefaultLimit(windowSeconds: "2");
        var client = limited.CreateClient();
        for (var i = 0; i < 11; i++)
        {
            await PostEmpty(client);
        }
        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostEmpty(client)).StatusCode);

        // Act
        await Task.Delay(TimeSpan.FromSeconds(2.5));
        var response = await PostEmpty(client);

        // Assert
        Assert.NotEqual(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task Renewal_AllowsSixtyRequestsAMinute_ThenRejects()
    {
        // Arrange
        using var limited = WithDefaultLimit();
        var client = limited.CreateClient();

        // Act
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 60; i++)
        {
            statuses.Add((await PostRefresh(client)).StatusCode);
        }
        var rejected = await PostRefresh(client);

        // Assert
        Assert.DoesNotContain(HttpStatusCode.TooManyRequests, statuses);
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
    }

    [Fact]
    public async Task SignInBucketFull_DoesNotBlockRenewal()
    {
        // Arrange
        using var limited = WithDefaultLimit();
        var client = limited.CreateClient();
        for (var i = 0; i < 11; i++)
        {
            await PostEmpty(client);
        }
        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostEmpty(client)).StatusCode);

        // Act
        var renewal = await PostRefresh(client);

        // Assert
        Assert.NotEqual(HttpStatusCode.TooManyRequests, renewal.StatusCode);
    }

    [Fact]
    public async Task RenewalBucketFull_DoesNotBlockSignIn()
    {
        // Arrange
        using var limited = WithDefaultLimit();
        var client = limited.CreateClient();
        for (var i = 0; i < 61; i++)
        {
            await PostRefresh(client);
        }
        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostRefresh(client)).StatusCode);

        // Act
        var signIn = await PostEmpty(client);

        // Assert
        Assert.NotEqual(HttpStatusCode.TooManyRequests, signIn.StatusCode);
    }

    [Fact]
    public async Task EndpointsOutsideAuthentication_AreNotLimited()
    {
        // Arrange
        using var limited = WithDefaultLimit();
        var client = limited.CreateClient();

        // Act
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 20; i++)
        {
            statuses.Add((await client.GetAsync("/api/me")).StatusCode);
        }

        // Assert
        Assert.DoesNotContain(HttpStatusCode.TooManyRequests, statuses);
    }

    // Note: a null value hides the high limits set by the factory, so the settings from appsettings.json apply (10 and 60 a minute)
    private WebApplicationFactory<Program> WithDefaultLimit(string? windowSeconds = null) =>
        _factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimit:AuthRequestsPerMinute"] = null,
                ["RateLimit:RefreshRequestsPerMinute"] = null,
                ["RateLimit:AuthWindowSeconds"] = windowSeconds,
            })));

    // Note: no X-Requested-With header, so the server answers 403 at once, but the limiter has counted the request already
    private static Task<HttpResponseMessage> PostRefresh(HttpClient client) =>
        client.PostAsync("/api/auth/refresh", content: null);

    private static Task<HttpResponseMessage> PostEmpty(HttpClient client) =>
        client.PostAsJsonAsync(SignInPath, new { });

    private static Task<HttpResponseMessage> Post(HttpClient client, string path, string? ip = null)
    {
        // Note: an unusable credential is answered with 401 at once, but the limiter has counted the request already
        var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(new { credential = TestGoogle.InvalidCredential }),
        };
        if (ip is not null)
        {
            request.Headers.Add("X-Test-Ip", ip);
        }
        return client.SendAsync(request);
    }
}
