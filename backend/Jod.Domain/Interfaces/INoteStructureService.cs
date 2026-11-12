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
}
