using Jod.Domain.Enums;

namespace Jod.Domain.RequestModels;

public class MoveNoteRequestModel
{
    /// <summary>Where the note goes. Required.</summary>
    public NotePlacement? Placement { get; set; }

    /// <summary>The new parent. Required for Child, not allowed for Root and Unplaced.</summary>
    public Guid? ParentId { get; set; }

    /// <summary>A sibling to put the note right before. Null means last. Not allowed for Unplaced.</summary>
    public Guid? BeforeId { get; set; }
}
