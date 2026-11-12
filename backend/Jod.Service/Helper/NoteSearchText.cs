using System.Text;
using System.Text.Json;

namespace Jod.Service.Helper;

/// <summary>
/// The plain text of a stored block document, kept in Notes.SearchText for searching: every string value of a property
/// named "text" at any depth, joined with a newline. It must give the same result as the SQL that filled the column for
/// the notes that existed before (migration AddNoteSearch). That SQL reads jsonb, which keeps object keys ordered by
/// length and then by bytes (a duplicate key keeps the last value), so this walk visits keys in that order too.
/// Bad JSON gives an empty text. Context is never part of it.
/// </summary>
public static class NoteSearchText
{
    // Note: stored content was checked on the way in and may be deeply nested, so the depth is generous like NoteService's
    private static readonly JsonDocumentOptions StoredOptions = new() { MaxDepth = 1024 };

    public static string FromContentJson(string contentJson)
    {
        try
        {
            using var parsed = JsonDocument.Parse(contentJson, StoredOptions);
            var texts = new List<string>();
            // Note: a stack instead of recursion so a deep document cannot overflow the call stack; children are pushed
            // in reverse so they come out in document order (parent text first, then its descendants)
            var pending = new Stack<JsonElement>();
            pending.Push(parsed.RootElement);
            while (pending.Count > 0)
            {
                var element = pending.Pop();
                if (element.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in element.EnumerateArray().Reverse())
                    {
                        pending.Push(item);
                    }
                }
                else if (element.ValueKind == JsonValueKind.Object)
                {
                    var properties = new Dictionary<string, JsonElement>();
                    foreach (var property in element.EnumerateObject())
                    {
                        properties[property.Name] = property.Value;
                    }
                    var ordered = properties
                        .OrderBy(property => Encoding.UTF8.GetByteCount(property.Key))
                        .ThenBy(property => property.Key, StringComparer.Ordinal)
                        .ToList();
                    foreach (var (name, value) in ordered)
                    {
                        if (name == "text" && value.ValueKind == JsonValueKind.String)
                        {
                            texts.Add(value.GetString()!);
                        }
                    }
                    for (var index = ordered.Count - 1; index >= 0; index--)
                    {
                        pending.Push(ordered[index].Value);
                    }
                }
            }
            return string.Join('\n', texts);
        }
        catch (JsonException)
        {
            return "";
        }
    }
}
