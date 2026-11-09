namespace Jod.Domain.ViewModels;

public class NoteListItemViewModel
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
