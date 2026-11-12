namespace Jod.Domain.ViewModels;

public class NoteSearchPageViewModel
{
    public required List<NoteSearchResultViewModel> Items { get; set; }

    /// <summary>True when more matches exist after this page.</summary>
    public bool HasMore { get; set; }
}
