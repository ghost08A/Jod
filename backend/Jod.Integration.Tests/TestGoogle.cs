using System.Net.Http.Json;
using System.Text.Json;

namespace Jod.Integration.Tests;

/// <summary>
/// Test side of Google Sign-In. Tests cannot call Google, so a "credential" here is a small JSON text that
/// FakeGoogleIdTokenVerifier turns into the claims a verified Google ID token would hold.
/// </summary>
public static class TestGoogle
{
    public const string InvalidCredential = "invalid-token";
    public const string GoogleUnreachable = "google-unreachable";

    // Note: the factory puts these emails on the allowed list, so most tests can take a fresh member without any setup
    public const int PoolSize = 1000;
    private static int _lastIndex = -1;

    public static string PoolEmail(int index) => $"member{index}@gmail.com";

    public static string NewEmail()
    {
        var index = Interlocked.Increment(ref _lastIndex);
        return index < PoolSize
            ? PoolEmail(index)
            : throw new InvalidOperationException("The pool of allowed test emails is used up, raise TestGoogle.PoolSize.");
    }

    // Note: the same email always gives the same Google "sub", so signing in twice with one email is the same person
    public static string SubjectFor(string email) => $"sub-{email.Trim().ToLowerInvariant()}";

    public static string Credential(string email, string? subject = null, bool emailVerified = true, string? hostedDomain = null) =>
        JsonSerializer.Serialize(new { sub = subject ?? SubjectFor(email), email, emailVerified, hd = hostedDomain });

    public static Task<HttpResponseMessage> SignInWithCredentialAsync(
        HttpClient client, string credential, bool withRequestedWithHeader = true) =>
        SendAsync(client, new { credential }, withRequestedWithHeader);

    public static Task<HttpResponseMessage> SignInAsync(HttpClient client, string? email = null) =>
        SignInWithCredentialAsync(client, Credential(email ?? NewEmail()));

    public static async Task<string> SignInAndGetAccessTokenAsync(HttpClient client, string? email = null)
    {
        var response = await SignInAsync(client, email);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;
    }

    public static Task<HttpResponseMessage> SendAsync(HttpClient client, object body, bool withRequestedWithHeader = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/google") { Content = JsonContent.Create(body) };
        if (withRequestedWithHeader)
        {
            request.Headers.Add("X-Requested-With", "jod");
        }
        return client.SendAsync(request);
    }
}
