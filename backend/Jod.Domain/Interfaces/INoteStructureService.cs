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

    /// <summary>
    /// Physically removes (no Trash) a note that is still untouched: alive, Unplaced, at baseVersion, default title,
    /// empty context and content, and no note at all under it. Returns false and changes nothing otherwise.
    /// A missing, foreign or deleted note throws NotFound; a missing or negative baseVersion throws a validation error.
    /// </summary>
    Task<bool> DiscardEmptyAsync(Guid userId, Guid noteId, DiscardEmptyNoteRequestModel request);

    /// <summary>
    /// Takes a note out of the Trash. It goes back under its original parent (or among the roots) as the last child when that
    /// place is still alive, otherwise Unplaced; descendants deleted in the same action come with it. Not in the Trash, missing
    /// or foreign throws NotFound.
    /// </summary>
    Task<NoteListItemViewModel> RestoreAsync(Guid userId, Guid noteId);

    /// <summary>
    /// Physically removes a note in the Trash and its descendants in the same delete action. Returns how many were removed.
    /// An alive, missing or foreign note throws NotFound.
    /// </summary>
    Task<int> DeletePermanentlyAsync(Guid userId, Guid noteId);

    /// <summary>Every deleted note of the user, newest delete first, as it sat when it was deleted.</summary>
    Task<List<TrashNoteViewModel>> ListTrashAsync(Guid userId);
}
