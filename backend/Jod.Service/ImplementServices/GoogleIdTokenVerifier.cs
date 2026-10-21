using Google.Apis.Auth;
using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.Models;
using Jod.Service.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jod.Service.ImplementServices;

/// <summary>
/// Real verifier. The Google library checks the signature (with Google's public keys, which it caches),
/// the audience (our Client ID), the issuer and the expiry. The log gets only a short label saying which
/// kind of failure it was, never the token, the exception text or anything read from the token.
/// </summary>
public class GoogleIdTokenVerifier(IOptions<GoogleOptions> googleOptions, ILogger<GoogleIdTokenVerifier> logger) : IGoogleIdTokenVerifier
{
    public async Task<GoogleIdentity> VerifyAsync(string credential)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = [googleOptions.Value.ClientId] };

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(credential, settings);
        }
        catch (InvalidJwtException exception)
        {
            logger.LogWarning("Google ID token rejected: {Reason}", DescribeRejection(exception.Message));
            throw GoogleSignInFailed();
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            // Note: not the user's fault, so it must not look like a rejected sign-in (401). The type names are
            // enough to tell a timeout from a DNS or connection failure without logging any message text
            logger.LogWarning(
                "Google could not be reached to check an ID token: {ExceptionType}, inner {InnerExceptionType}, status {StatusCode}",
                exception.GetType().Name, exception.InnerException?.GetType().Name, (exception as HttpRequestException)?.StatusCode);
            throw new CustomError("ตรวจสอบกับ Google ไม่ได้ชั่วคราว ลองอีกครั้ง", ErrorKind.Unavailable);
        }

        if (string.IsNullOrEmpty(payload.Subject) || string.IsNullOrEmpty(payload.Email))
        {
            logger.LogWarning("Google ID token rejected: {Reason}", "missing-subject-or-email");
            throw GoogleSignInFailed();
        }
        return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.HostedDomain);
    }

    /// <summary>
    /// Turns the library's fixed rejection text into a short label that is safe to log. The text itself is
    /// never logged. Anything not recognised becomes "other".
    /// </summary>
    public static string DescribeRejection(string libraryMessage) => libraryMessage switch
    {
        _ when libraryMessage.Contains("unable to verify signature", StringComparison.OrdinalIgnoreCase) => "signature",
        _ when libraryMessage.Contains("untrusted 'aud'", StringComparison.OrdinalIgnoreCase) => "audience",
        _ when libraryMessage.Contains("issuer", StringComparison.OrdinalIgnoreCase) => "issuer",
        _ when libraryMessage.Contains("has expired", StringComparison.OrdinalIgnoreCase) => "expired",
        _ when libraryMessage.Contains("not yet valid", StringComparison.OrdinalIgnoreCase) => "not-yet-valid",
        _ when libraryMessage.Contains("'hd'", StringComparison.OrdinalIgnoreCase) => "hosted-domain",
        _ when libraryMessage.Contains("must consist", StringComparison.OrdinalIgnoreCase)
            || libraryMessage.Contains("must contain", StringComparison.OrdinalIgnoreCase)
            || libraryMessage.Contains("algorithm", StringComparison.OrdinalIgnoreCase)
            || libraryMessage.Contains("exceeds", StringComparison.OrdinalIgnoreCase) => "malformed",
        _ => "other",
    };

    private static CustomError GoogleSignInFailed() =>
        new("เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง", ErrorKind.Unauthorized);
}
