using System.Text.Json;

namespace Jod.Domain.RequestModels;

/// <summary>Everything is optional: a note can be created from an empty request.</summary>
public class CreateNoteRequestModel
{
    public string? Title { get; set; }

    public string? Context { get; set; }

    /// <summary>The block document, validated by the Service. Null means an empty document.</summary>
    public JsonElement? Content { get; set; }
}
