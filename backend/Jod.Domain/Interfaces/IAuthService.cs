using Jod.Domain.Models;
using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;

namespace Jod.Domain.Interfaces;

public interface IAuthService
{
    /// <summary>Verifies the Google ID token, checks the allowed list, finds or creates the user and starts a session.</summary>
    Task<AuthSessionModel> SignInWithGoogleAsync(GoogleSignInRequestModel request);

    /// <summary>Swaps a valid refresh token for a new one. Reusing an old token revokes the whole family.</summary>
    Task<AuthSessionModel> RefreshAsync(string? refreshToken);

    /// <summary>Revokes the family of this refresh token. Does nothing for a missing or unknown token.</summary>
    Task LogoutAsync(string? refreshToken);

    Task<UserViewModel> GetUserAsync(Guid userId);
}
