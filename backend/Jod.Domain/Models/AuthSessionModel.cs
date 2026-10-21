using Jod.Domain.ViewModels;

namespace Jod.Domain.Models;

/// <summary>
/// What a sign-in produces inside the server: the result sent to the user plus the refresh token
/// that only goes into a cookie. It is a separate type so the refresh token can never end up in a JSON body.
/// </summary>
public class AuthSessionModel
{
    public required AuthResultViewModel Result { get; set; }

    public required string RefreshToken { get; set; }

    public DateTimeOffset RefreshTokenExpiresAt { get; set; }
}
