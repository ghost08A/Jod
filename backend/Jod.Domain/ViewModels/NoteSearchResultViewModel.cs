namespace Jod.Domain.ViewModels;

public class NoteSearchResultViewModel
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Every ancestor from the top down; empty for a top-level or Unplaced note.</summary>
    public required List<NoteSearchPathItemViewModel> Path { get; set; }

    /// <summary>About 100 characters of the content around the first match (not marked).</summary>
    public required string Snippet { get; set; }
}

public class NoteSearchPathItemViewModel
{
    public Guid Id { get; set; }

    public required string Title { get; set; }
}
