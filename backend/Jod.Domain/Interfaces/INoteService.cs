using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;

namespace Jod.Domain.Interfaces;

/// <summary>Every method works on one owner's notes only. A note of another owner behaves like a missing note.</summary>
public interface INoteService
{
    Task<NoteViewModel> CreateAsync(Guid userId, CreateNoteRequestModel request);

    /// <summary>The caller's notes, newest change first, without content.</summary>
    Task<List<NoteListItemViewModel>> ListAsync(Guid userId);

    Task<NoteViewModel> GetAsync(Guid userId, Guid noteId);

    /// <summary>
    /// Saves when BaseVersion is the stored version. Another version throws a Conflict error that carries
    /// the current note. A missing or foreign note throws a NotFound error.
    /// </summary>
    Task<NoteViewModel> UpdateAsync(Guid userId, Guid noteId, UpdateNoteRequestModel request);

    /// <summary>
    /// What reference cards show, one item per distinct id in first-appearance order. Only the caller's own notes are
    /// alive or trashed; another user's note and a missing note are both missing. 1 to 100 ids, else a validation error.
    /// </summary>
    Task<List<NoteCardViewModel>> GetCardsAsync(Guid userId, NoteCardsRequestModel request);
}
