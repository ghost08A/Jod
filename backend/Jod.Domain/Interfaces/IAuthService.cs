using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;

namespace Jod.Domain.Interfaces;

public interface IAuthService
{
    Task<AuthResultViewModel> RegisterAsync(RegisterRequestModel request);

    Task<AuthResultViewModel> LoginAsync(LoginRequestModel request);

    Task<UserViewModel> GetUserAsync(Guid userId);
}
