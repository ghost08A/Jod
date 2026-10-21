using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Service.ImplementServices;
using Jod.Service.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jod.Service.Tests;

public class GoogleIdTokenVerifierTests
{
    // Note: these are the fixed texts of Google.Apis.Auth 1.77.0, copied from the library
    [Theory]
    [InlineData("JWT invalid, unable to verify signature.", "signature")]
    [InlineData("JWT contains untrusted 'aud' claim.", "audience")]
    [InlineData("JWT issuer incorrect. Must be one of: accounts.google.com", "issuer")]
    [InlineData("JWT has expired.", "expired")]
    [InlineData("JWT is not yet valid.", "not-yet-valid")]
    [InlineData("JWT contains invalid 'hd' claim.", "hosted-domain")]
    [InlineData("JWT must consist of Header, Payload, and Signature", "malformed")]
    [InlineData("JWT must contain 'iat' and 'exp' claims", "malformed")]
    [InlineData("JWT algorithm must be 'RS256'", "malformed")]
    [InlineData("something the library says in the future", "other")]
    public void DescribeRejection_TurnsTheLibraryTextIntoAShortLabel(string libraryMessage, string expectedLabel)
    {
        // Act
        var label = GoogleIdTokenVerifier.DescribeRejection(libraryMessage);

        // Assert
        Assert.Equal(expectedLabel, label);
    }

    [Fact]
    public async Task VerifyAsync_WithAMalformedToken_IsUnauthorized_AndLogsOnlyTheLabel()
    {
        // Arrange
        var logger = new CapturingLogger();
        var verifier = new GoogleIdTokenVerifier(
            Microsoft.Extensions.Options.Options.Create(new GoogleOptions { ClientId = "test-client-id.apps.googleusercontent.com" }), logger);
        const string token = "not-a-jwt-marker-7719";

        // Act
        var error = await Assert.ThrowsAsync<CustomError>(() => verifier.VerifyAsync(token));

        // Assert
        Assert.Equal(ErrorKind.Unauthorized, error.Kind);
        var line = Assert.Single(logger.Lines);
        Assert.Equal("Google ID token rejected: malformed", line);
        Assert.DoesNotContain(token, line);
    }

    private sealed class CapturingLogger : ILogger<GoogleIdTokenVerifier>
    {
        public List<string> Lines { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Lines.Add(formatter(state, exception) + (exception is null ? "" : $" [exception: {exception}]"));
    }
}
