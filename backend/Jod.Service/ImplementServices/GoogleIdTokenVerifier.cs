using Google.Apis.Auth;
using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.Models;
using Jod.Service.Options;
using Microsoft.Extensions.Options;

namespace Jod.Service.ImplementServices;

/// <summary>
/// Real verifier. The Google library checks the signature (with Google's public keys, which it caches),
/// the audience (our Client ID), the issuer and the expiry. This class never logs the token or exception text.
/// </summary>
public class GoogleIdTokenVerifier(IOptions<GoogleOptions> googleOptions) : IGoogleIdTokenVerifier
{
    public async Task<GoogleIdentity> VerifyAsync(string credential)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = [googleOptions.Value.ClientId] };

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(credential, settings);
        }
        catch (InvalidJwtException)
        {
            throw GoogleSignInFailed();
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            // Note: not the user's fault, so it must not look like a rejected sign-in (401)
            throw new CustomError("ตรวจสอบกับ Google ไม่ได้ชั่วคราว ลองอีกครั้ง", ErrorKind.Unavailable);
        }

        if (string.IsNullOrEmpty(payload.Subject) || string.IsNullOrEmpty(payload.Email))
        {
            throw GoogleSignInFailed();
        }
        return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.HostedDomain);
    }

    private static CustomError GoogleSignInFailed() =>
        new("เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง", ErrorKind.Unauthorized);
}
