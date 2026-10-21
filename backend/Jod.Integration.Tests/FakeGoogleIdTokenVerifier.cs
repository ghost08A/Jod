using System.Text.Json;
using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.Models;

namespace Jod.Integration.Tests;

/// <summary>
/// Stands in for the real verifier. The credential is the JSON text built by TestGoogle.Credential;
/// anything else is an unusable token, and TestGoogle.GoogleUnreachable simulates Google being down.
/// </summary>
public sealed class FakeGoogleIdTokenVerifier : IGoogleIdTokenVerifier
{
    public Task<GoogleIdentity> VerifyAsync(string credential)
    {
        if (credential == TestGoogle.GoogleUnreachable)
        {
            throw new CustomError("ตรวจสอบกับ Google ไม่ได้ชั่วคราว ลองอีกครั้ง", ErrorKind.Unavailable);
        }

        try
        {
            using var document = JsonDocument.Parse(credential);
            var root = document.RootElement;
            var hostedDomain = root.TryGetProperty("hd", out var hd) && hd.ValueKind == JsonValueKind.String ? hd.GetString() : null;
            return Task.FromResult(new GoogleIdentity(
                root.GetProperty("sub").GetString()!,
                root.GetProperty("email").GetString()!,
                root.GetProperty("emailVerified").GetBoolean(),
                hostedDomain));
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw new CustomError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง", ErrorKind.Unauthorized);
        }
    }
}
