namespace Jod.Service.Data;

/// <summary>
/// One refresh token issued to a device. Tokens rotated from each other share a FamilyId,
/// so reuse of an old token can revoke the whole family. Only the SHA-256 hash is stored.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid FamilyId { get; set; }
    public required byte[] TokenHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedById { get; set; }
}
