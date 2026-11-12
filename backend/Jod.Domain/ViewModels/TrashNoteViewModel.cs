using Jod.Domain.Enums;

namespace Jod.Domain.ViewModels;

/// <summary>A deleted note without content. Placement, ParentId and Position are the values it had when it was deleted.</summary>
public class TrashNoteViewModel
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public DateTimeOffset DeletedAt { get; set; }

    public Guid TrashBatchId { get; set; }

    public NotePlacement Placement { get; set; }

    public Guid? ParentId { get; set; }

    public int Position { get; set; }
}
