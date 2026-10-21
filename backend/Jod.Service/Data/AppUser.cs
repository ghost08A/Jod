namespace Jod.Service.Data;

/// <summary>
/// A member of Jod. Identified by the Google "sub"; the email is only the latest value seen
/// in a Google token and may change.
/// </summary>
public class AppUser
{
    public Guid Id { get; set; }
    public required string GoogleSubject { get; set; }
    public required string Email { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
