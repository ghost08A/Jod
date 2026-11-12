using Jod.Domain.Enums;

namespace Jod.Domain.ViewModels;

/// <summary>What a reference card shows. Status is alive, trashed or missing; the other fields are null when missing.</summary>
public class NoteCardViewModel
{
    public Guid NoteId { get; set; }

    public required string Status { get; set; }

    public string? Title { get; set; }

    public string? ParentTitle { get; set; }

    public NotePlacement? Placement { get; set; }
}
