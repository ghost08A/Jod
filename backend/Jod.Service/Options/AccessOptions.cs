namespace Jod.Service.Options;

/// <summary>The closed group: only these emails may use Jod. An empty list lets nobody in.</summary>
public class AccessOptions
{
    public const string SectionName = "Access";

    public List<string> AllowedEmails { get; set; } = [];

    // Note: case and surrounding spaces do not matter
    public bool IsAllowed(string email) =>
        AllowedEmails.Any(allowed => string.Equals(allowed.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase));
}
