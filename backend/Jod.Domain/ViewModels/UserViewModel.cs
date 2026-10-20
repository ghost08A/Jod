namespace Jod.Domain.ViewModels;

public class UserViewModel
{
    public Guid Id { get; set; }

    public required string Email { get; set; }

    public bool EmailConfirmed { get; set; }
}
