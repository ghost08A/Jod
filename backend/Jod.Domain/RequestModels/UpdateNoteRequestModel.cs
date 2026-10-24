using System.Text.Json;
using System.Text.Json.Serialization;

namespace Jod.Domain.RequestModels;

/// <summary>A whole-note save. The owner never comes from the body, only from the signed-in user.</summary>
public class UpdateNoteRequestModel
{
    /// <summary>Required. An empty or whitespace-only title is stored as "Untitled".</summary>
    public string? Title { get; set; }

    /// <summary>Required. An empty context is valid.</summary>
    public string? Context { get; set; }

    /// <summary>The block document, validated by the Service. Required.</summary>
    public JsonElement? Content { get; set; }

    /// <summary>The version the caller last saw. Required; a different value from the stored one is a conflict.</summary>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public int? BaseVersion { get; set; }
}
