using System.Buffers;
using System.Text;
using System.Text.Json;
using Jod.Domain;
using Jod.Service.Options;

namespace Jod.Service.Helper;

/// <summary>
/// The rules for what a note may hold: title, context and the block document. Pure functions, nothing is stored.
/// The block walk uses a stack instead of recursion so a deep document cannot overflow the call stack.
/// Messages are Thai and never repeat what the caller sent.
/// </summary>
public static class NoteContentValidator
{
    public const string DefaultTitle = "Untitled";
    public const string EmptyContentJson = "{\"schemaVersion\":1,\"blocks\":[]}";

    private const string InvalidContentMessage = "เนื้อหาของโน้ตไม่ถูกต้อง";
    private const string ContentTooLargeMessage = "เนื้อหาของโน้ตใหญ่เกินกำหนด";
    private const string ContentTooDeepMessage = "เนื้อหาของโน้ตซ้อนลึกเกินกำหนด";

    private static readonly string[] TextBlockProperties = ["id", "type", "text"];
    private static readonly string[] HeadingProperties = ["id", "type", "text", "level"];
    private static readonly string[] ParentBlockProperties = ["id", "type", "text", "children"];
    private static readonly string[] ChecklistProperties = ["id", "type", "text", "checked", "children"];
    private static readonly string[] CodeProperties = ["id", "type", "text", "language"];
    private static readonly string[] DividerProperties = ["id", "type"];

    /// <summary>Trims the title; an empty one becomes "Untitled". The web client has the same rule.</summary>
    public static string NormalizeTitle(string? title, NoteOptions options)
    {
        var trimmed = title?.Trim() ?? "";
        if (trimmed.Length == 0)
        {
            return DefaultTitle;
        }
        RequireTextWithin(trimmed, options.TitleMaxLength, "ชื่อโน้ต");
        return trimmed;
    }

    public static string NormalizeContext(string? context, NoteOptions options)
    {
        var text = context ?? "";
        RequireTextWithin(text, options.ContextMaxLength, "บริบทของโน้ต");
        return text;
    }

    /// <summary>Throws a CustomError (400) unless the document follows every rule.</summary>
    public static void Validate(JsonElement content, NoteOptions options)
    {
        if (content.ValueKind != JsonValueKind.Object)
        {
            throw new CustomError(InvalidContentMessage);
        }
        if (Encoding.UTF8.GetByteCount(content.GetRawText()) > options.ContentMaxBytes)
        {
            throw new CustomError(ContentTooLargeMessage);
        }

        try
        {
            ValidateDocument(content, options.MaxBlockDepth);
        }
        catch (InvalidOperationException)
        {
            // Note: reading a string that holds a broken surrogate pair escape throws; that is bad data from the client
            throw new CustomError(InvalidContentMessage);
        }
    }

    private static void ValidateDocument(JsonElement document, int maxBlockDepth)
    {
        var sawSchemaVersion = false;
        JsonElement? blocks = null;
        foreach (var property in document.EnumerateObject())
        {
            switch (property.Name)
            {
                case "schemaVersion" when !sawSchemaVersion
                    && property.Value.ValueKind == JsonValueKind.Number
                    && property.Value.TryGetInt32(out var version) && version == 1:
                    sawSchemaVersion = true;
                    break;
                case "blocks" when blocks is null && property.Value.ValueKind == JsonValueKind.Array:
                    blocks = property.Value;
                    break;
                default:
                    throw new CustomError(InvalidContentMessage);
            }
        }
        if (!sawSchemaVersion || blocks is null)
        {
            throw new CustomError(InvalidContentMessage);
        }

        var seenIds = new HashSet<Guid>();
        var pending = new Stack<(JsonElement Blocks, int Depth)>();
        pending.Push((blocks.Value, 1));
        while (pending.Count > 0)
        {
            var (levelBlocks, depth) = pending.Pop();
            foreach (var block in levelBlocks.EnumerateArray())
            {
                if (depth > maxBlockDepth)
                {
                    throw new CustomError(ContentTooDeepMessage);
                }
                if (ValidateBlock(block, seenIds) is { } children)
                {
                    pending.Push((children, depth + 1));
                }
            }
        }
    }

    /// <summary>Checks one block and returns its children array when it has one.</summary>
    private static JsonElement? ValidateBlock(JsonElement block, HashSet<Guid> seenIds)
    {
        if (block.ValueKind != JsonValueKind.Object)
        {
            throw new CustomError(InvalidContentMessage);
        }

        var properties = new Dictionary<string, JsonElement>();
        foreach (var property in block.EnumerateObject())
        {
            if (!properties.TryAdd(property.Name, property.Value))
            {
                throw new CustomError(InvalidContentMessage);
            }
        }

        var type = properties.TryGetValue("type", out var typeElement) ? ReadText(typeElement) : null;
        var allowed = type switch
        {
            "paragraph" or "quote" => TextBlockProperties,
            "heading" => HeadingProperties,
            "bullet" or "numbered" or "toggle" => ParentBlockProperties,
            "checklist" => ChecklistProperties,
            "code" => CodeProperties,
            "divider" => DividerProperties,
            _ => null,
        };
        if (allowed is null || properties.Keys.Any(name => !allowed.Contains(name)))
        {
            throw new CustomError(InvalidContentMessage);
        }

        var idText = properties.TryGetValue("id", out var idElement) ? ReadText(idElement) : null;
        if (!Guid.TryParseExact(idText, "D", out var id) || !seenIds.Add(id))
        {
            throw new CustomError(InvalidContentMessage);
        }
        if (type != "divider" && (!properties.TryGetValue("text", out var text) || ReadText(text) is null))
        {
            throw new CustomError(InvalidContentMessage);
        }
        if (type == "heading"
            && !(properties.TryGetValue("level", out var level) && level.ValueKind == JsonValueKind.Number
                && level.TryGetInt32(out var levelNumber) && levelNumber is >= 1 and <= 3))
        {
            throw new CustomError(InvalidContentMessage);
        }
        if (properties.TryGetValue("checked", out var isChecked) && isChecked.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            throw new CustomError(InvalidContentMessage);
        }
        if (properties.TryGetValue("language", out var language) && ReadText(language) is null)
        {
            throw new CustomError(InvalidContentMessage);
        }
        if (properties.TryGetValue("children", out var children))
        {
            return children.ValueKind == JsonValueKind.Array ? children : throw new CustomError(InvalidContentMessage);
        }
        return null;
    }

    /// <summary>The string value, or null when it is not a string or holds a character the database cannot store.</summary>
    private static string? ReadText(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.String)
        {
            return null;
        }
        var text = element.GetString();
        return text is not null && CountCodePoints(text) >= 0 ? text : null;
    }

    private static void RequireTextWithin(string text, int maxCodePoints, string label)
    {
        var count = CountCodePoints(text);
        if (count < 0)
        {
            throw new CustomError($"{label}มีอักขระที่ใช้ไม่ได้");
        }
        if (count > maxCodePoints)
        {
            throw new CustomError($"{label}ต้องไม่เกิน {maxCodePoints} ตัวอักษร");
        }
    }

    /// <summary>
    /// Counts Unicode code points (an emoji is 1, not 2). Returns -1 for text PostgreSQL cannot store:
    /// a NUL character or a half of a surrogate pair.
    /// </summary>
    private static int CountCodePoints(string text)
    {
        var count = 0;
        for (var index = 0; index < text.Length;)
        {
            if (text[index] == '\0'
                || Rune.DecodeFromUtf16(text.AsSpan(index), out _, out var consumed) != OperationStatus.Done)
            {
                return -1;
            }
            index += consumed;
            count++;
        }
        return count;
    }
}
