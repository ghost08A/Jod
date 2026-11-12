using System.Text.Json;

namespace Jod.Service.Helper;

/// <summary>
/// Tells whether a stored block document has nothing written yet. Same meaning as the web client's isEmptyNoteDocument:
/// no blocks, or one paragraph with no text. Anything else, including a document of the wrong shape, is NOT empty,
/// so a doubtful note is never discarded.
/// </summary>
public static class NoteEmptiness
{
    // Note: stored content was checked on the way in and may be deeply nested, so the depth is generous like NoteService's
    private static readonly JsonDocumentOptions StoredOptions = new() { MaxDepth = 1024 };

    public static bool IsEmptyDocument(string contentJson)
    {
        try
        {
            using var parsed = JsonDocument.Parse(contentJson, StoredOptions);
            var root = parsed.RootElement;
            if (root.ValueKind != JsonValueKind.Object || root.EnumerateObject().Count() != 2
                || !root.TryGetProperty("schemaVersion", out var version) || version.ValueKind != JsonValueKind.Number
                || !version.TryGetInt32(out var versionNumber) || versionNumber != 1
                || !root.TryGetProperty("blocks", out var blocks) || blocks.ValueKind != JsonValueKind.Array)
            {
                return false;
            }
            return blocks.GetArrayLength() switch
            {
                0 => true,
                1 => IsEmptyParagraph(blocks[0]),
                _ => false,
            };
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool IsEmptyParagraph(JsonElement block) =>
        block.ValueKind == JsonValueKind.Object
        && block.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String && type.GetString() == "paragraph"
        && block.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String && text.GetString() == ""
        && block.EnumerateObject().All(property => property.Name is "id" or "type" or "text");
}
