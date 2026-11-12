using Jod.Domain.Enums;

namespace Jod.Domain.ViewModels;

public class NoteListItemViewModel
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public NotePlacement Placement { get; set; }

    public Guid? ParentId { get; set; }

    public int Position { get; set; }
}
