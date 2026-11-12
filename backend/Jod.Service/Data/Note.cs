using Jod.Domain.Enums;

namespace Jod.Service.Data;

/// <summary>
/// One note of one user. Content is the whole block document as one jsonb value (ADR 0005).
/// Version rises by 1 on every save and is how two saves of the same note are told apart.
/// </summary>
public class Note
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public required string Title { get; set; }
    public required string Context { get; set; }
    // Note: kept as JSON text on purpose. Npgsql's own JsonDocument mapping reads with a depth limit of 64,
    // which cannot hold 100 nested block levels, and text passes through to jsonb untouched
    public required string Content { get; set; }
    public int Version { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    // Note: the structure columns are not part of Version; a content save never writes them
    public NotePlacement Placement { get; set; }
    public Guid? ParentId { get; set; }
    /// <summary>Order among the notes that share the same parent.</summary>
    public int Position { get; set; }
    /// <summary>When the note was deleted (it is in the Trash); null while it is alive.</summary>
    public DateTimeOffset? DeletedAt { get; set; }
    /// <summary>The same value for everything one delete action took to the Trash.</summary>
    public Guid? TrashBatchId { get; set; }
    // Note: where the note sat just before it was deleted; a later restore reads these
    public NotePlacement? OriginalPlacement { get; set; }
    public Guid? OriginalParentId { get; set; }
}
