namespace Jod.Domain.ViewModels;

public class AuthResultViewModel
{
    public required string AccessToken { get; set; }

    public int ExpiresInSeconds { get; set; }

    public required UserViewModel User { get; set; }
}
