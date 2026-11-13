namespace Jod.Domain.RequestModels;

public class NoteCardsRequestModel
{
    /// <summary>The notes the cards point at. Required, 1 to 100 ids.</summary>
    public List<Guid>? NoteIds { get; set; }
}
