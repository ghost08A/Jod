using System.Text.Json.Serialization;

namespace Jod.Domain.RequestModels;

/// <summary>Asks the server to discard an untouched new note.</summary>
public class DiscardEmptyNoteRequestModel
{
    /// <summary>Required, 0 or more. The version the page last saw; a different stored version keeps the note.</summary>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public int? BaseVersion { get; set; }
}
