using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;

namespace Jod.Domain.Interfaces;

/// <summary>Where notes sit in the tree. Never touches a note's content, Version or UpdatedAt.</summary>
public interface INoteStructureService
{
    /// <summary>
    /// Moves one note (its children stay under it). A missing or foreign note or parent throws NotFound;
    /// a loop, a depth over the limit or a bad combination throws a validation error.
    /// </summary>
    Task<NoteListItemViewModel> MoveAsync(Guid userId, Guid noteId, MoveNoteRequestModel request);

    /// <summary>
    /// Deletes a note into the Trash. Scope "branch" takes the note and all its descendants, "single" only the note
    /// (its children take its place). Returns how many notes were deleted. A missing, foreign or already deleted note
    /// throws NotFound; any other scope throws a validation error.
    /// </summary>
    Task<int> DeleteAsync(Guid userId, Guid noteId, string scope);

    /// <summary>Every deleted note of the user, newest delete first, as it sat when it was deleted.</summary>
    Task<List<TrashNoteViewModel>> ListTrashAsync(Guid userId);
}
