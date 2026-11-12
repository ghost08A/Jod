using Jod.Domain.ViewModels;

namespace Jod.Domain.Interfaces;

/// <summary>Searches one owner's alive notes by title and content (never Context). Another owner's notes are never returned.</summary>
public interface INoteSearchService
{
    /// <summary>
    /// A page of 50 results: notes whose title holds the query first, then those that hold it only in the content, each group
    /// newest change first. A blank query gives an empty page; a query over 200 characters, a character the database cannot
    /// store, or a negative skip throws a validation error.
    /// </summary>
    Task<NoteSearchPageViewModel> SearchAsync(Guid userId, string? query, int skip);
}
