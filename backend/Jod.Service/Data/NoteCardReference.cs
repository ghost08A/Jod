namespace Jod.Service.Data;

/// <summary>
/// One reference card seen from the note that holds it: the source note has a card that points at the target note.
/// Rewritten with every content write of the source. The target is not a foreign key: the server never checks it.
/// </summary>
public class NoteCardReference
{
    public Guid SourceNoteId { get; set; }
    public Guid TargetNoteId { get; set; }
}
