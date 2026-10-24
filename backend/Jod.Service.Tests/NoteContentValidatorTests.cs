using System.Text;
using System.Text.Json;
using Jod.Domain;
using Jod.Service.Helper;
using Jod.Service.Options;

namespace Jod.Service.Tests;

public class NoteContentValidatorTests
{
    private static readonly NoteOptions Defaults = new();

    // ---- block document: accepted ----

    [Fact]
    public void Validate_EmptyBlocks_IsAccepted()
    {
        // Arrange
        var content = Parse(NoteContentValidator.EmptyContentJson);

        // Act
        var exception = Record.Exception(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Null(exception);
    }

    [Fact]
    public void Validate_EveryAllowedBlockType_IsAccepted()
    {
        // Arrange
        var content = Document(
            Block("paragraph", 1, "\"text\":\"a\""),
            Block("heading", 2, "\"text\":\"a\",\"level\":3"),
            Block("bullet", 3, "\"text\":\"a\",\"children\":[]"),
            Block("numbered", 4, "\"text\":\"a\""),
            Block("checklist", 5, "\"text\":\"a\",\"checked\":true,\"children\":[]"),
            Block("toggle", 6, "\"text\":\"a\",\"children\":[" + Block("paragraph", 7, "\"text\":\"\"") + "]"),
            Block("quote", 8, "\"text\":\"a\""),
            Block("code", 9, "\"text\":\"a\",\"language\":\"csharp\""),
            Block("divider", 10, ""));

        // Act
        var exception = Record.Exception(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Null(exception);
    }

    // ---- block document: rejected ----

    [Theory]
    [InlineData("[]")]
    [InlineData("\"text\"")]
    [InlineData("{\"blocks\":[]}")]
    [InlineData("{\"schemaVersion\":1}")]
    [InlineData("{\"schemaVersion\":2,\"blocks\":[]}")]
    [InlineData("{\"schemaVersion\":\"1\",\"blocks\":[]}")]
    [InlineData("{\"schemaVersion\":1,\"blocks\":{}}")]
    [InlineData("{\"schemaVersion\":1,\"blocks\":[],\"extra\":1}")]
    [InlineData("{\"schemaVersion\":1,\"schemaVersion\":1,\"blocks\":[]}")]
    [InlineData("{\"schemaVersion\":1,\"blocks\":[1]}")]
    public void Validate_BrokenDocumentShape_IsRejected(string json)
    {
        // Arrange
        var content = Parse(json);

        // Act
        var error = Assert.Throws<CustomError>(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Equal(["เนื้อหาของโน้ตไม่ถูกต้อง"], error.Messages);
    }

    [Theory]
    [InlineData("\"type\":\"image\",\"text\":\"a\"")]
    [InlineData("\"type\":\"Paragraph\",\"text\":\"a\"")]
    [InlineData("\"type\":5,\"text\":\"a\"")]
    [InlineData("\"text\":\"a\"")]
    public void Validate_UnknownOrMissingType_IsRejected(string properties)
    {
        // Arrange
        var content = Document($"{{\"id\":\"{Id(1)}\",{properties}}}");

        // Act + Assert
        AssertRejected(content);
    }

    [Theory]
    [InlineData("paragraph", "\"text\":\"a\",\"color\":\"red\"")]
    [InlineData("paragraph", "\"text\":\"a\",\"text\":\"b\"")]
    [InlineData("paragraph", "\"text\":\"a\",\"level\":1")]
    [InlineData("paragraph", "\"text\":\"a\",\"checked\":true")]
    [InlineData("paragraph", "\"text\":\"a\",\"language\":\"c\"")]
    [InlineData("bullet", "\"text\":\"a\",\"checked\":true")]
    [InlineData("code", "\"text\":\"a\",\"checked\":false")]
    [InlineData("divider", "\"text\":\"a\"")]
    public void Validate_UnknownOrMisplacedProperty_IsRejected(string type, string properties)
    {
        // Arrange
        var content = Document($"{{\"id\":\"{Id(1)}\",\"type\":\"{type}\",{properties}}}");

        // Act + Assert
        AssertRejected(content);
    }

    [Theory]
    [InlineData("paragraph")]
    [InlineData("heading")]
    [InlineData("quote")]
    [InlineData("code")]
    [InlineData("divider")]
    public void Validate_ChildrenOnALeafType_IsRejected(string type)
    {
        // Arrange
        var level = type == "heading" ? ",\"level\":1" : "";
        var text = type == "divider" ? "" : ",\"text\":\"a\"";
        var content = Document($"{{\"id\":\"{Id(1)}\",\"type\":\"{type}\"{text}{level},\"children\":[]}}");

        // Act + Assert
        AssertRejected(content);
    }

    [Theory]
    [InlineData("\"text\":\"a\",\"level\":0")]
    [InlineData("\"text\":\"a\",\"level\":4")]
    [InlineData("\"text\":\"a\",\"level\":1.5")]
    [InlineData("\"text\":\"a\",\"level\":\"1\"")]
    [InlineData("\"text\":\"a\"")]
    public void Validate_HeadingLevelOutsideOneToThree_IsRejected(string properties)
    {
        // Arrange
        var content = Document($"{{\"id\":\"{Id(1)}\",\"type\":\"heading\",{properties}}}");

        // Act + Assert
        AssertRejected(content);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("2")]
    [InlineData("3")]
    public void Validate_HeadingLevelOneToThree_IsAccepted(string level)
    {
        // Arrange
        var content = Document($"{{\"id\":\"{Id(1)}\",\"type\":\"heading\",\"text\":\"a\",\"level\":{level}}}");

        // Act
        var exception = Record.Exception(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Null(exception);
    }

    [Theory]
    [InlineData("checklist", "\"text\":\"a\",\"checked\":\"yes\"")]
    [InlineData("checklist", "\"text\":\"a\",\"checked\":1")]
    [InlineData("code", "\"text\":\"a\",\"language\":5")]
    [InlineData("paragraph", "\"text\":5")]
    [InlineData("paragraph", "\"text\":null")]
    [InlineData("paragraph", "")]
    [InlineData("toggle", "\"text\":\"a\",\"children\":{}")]
    [InlineData("toggle", "\"text\":\"a\",\"children\":[3]")]
    public void Validate_WrongValueType_IsRejected(string type, string properties)
    {
        // Arrange
        var separator = properties.Length == 0 ? "" : ",";
        var content = Document($"{{\"id\":\"{Id(1)}\",\"type\":\"{type}\"{separator}{properties}}}");

        // Act + Assert
        AssertRejected(content);
    }

    [Theory]
    [InlineData("\"id\":\"not-a-guid\"")]
    [InlineData("\"id\":\"\"")]
    [InlineData("\"id\":5")]
    [InlineData("\"id\":null")]
    [InlineData("\"id\":\"{00000000-0000-0000-0000-000000000001}\"")]
    [InlineData("\"id\":\"00000000000000000000000000000001\"")]
    public void Validate_IdThatIsNotAGuidString_IsRejected(string idProperty)
    {
        // Arrange
        var content = Document($"{{{idProperty},\"type\":\"paragraph\",\"text\":\"a\"}}");

        // Act + Assert
        AssertRejected(content);
    }

    [Fact]
    public void Validate_MissingId_IsRejected()
    {
        // Arrange
        var content = Document("{\"type\":\"paragraph\",\"text\":\"a\"}");

        // Act + Assert
        AssertRejected(content);
    }

    [Fact]
    public void Validate_SameIdTwiceAtTheSameLevel_IsRejected()
    {
        // Arrange
        var content = Document(Block("paragraph", 1, "\"text\":\"a\""), Block("paragraph", 1, "\"text\":\"b\""));

        // Act + Assert
        AssertRejected(content);
    }

    [Fact]
    public void Validate_SameIdInDifferentNestingLevels_IsRejected()
    {
        // Arrange
        var child = Block("paragraph", 1, "\"text\":\"child\"");
        var content = Document(
            Block("paragraph", 1, "\"text\":\"parent\""),
            Block("toggle", 2, "\"text\":\"t\",\"children\":[" + Block("bullet", 3, $"\"text\":\"b\",\"children\":[{child}]") + "]"));

        // Act + Assert
        AssertRejected(content);
    }

    [Fact]
    public void Validate_SameIdSpelledInUpperAndLowerCase_IsRejected()
    {
        // Arrange
        var lower = "{\"id\":\"aaaaaaaa-0000-0000-0000-000000000000\",\"type\":\"paragraph\",\"text\":\"a\"}";
        var upper = lower.Replace("aaaaaaaa", "AAAAAAAA");

        // Act + Assert
        AssertRejected(Document(lower, upper));
    }

    [Fact]
    public void Validate_TextWithNulCharacter_IsRejected()
    {
        // Arrange
        var content = Document(Block("paragraph", 1, "\"text\":\"a\\u0000b\""));

        // Act + Assert
        AssertRejected(content);
    }

    [Fact]
    public void Validate_TextWithAHalfSurrogatePair_IsRejectedAsBadDataNotAsAnException()
    {
        // Arrange
        var content = Document(Block("paragraph", 1, "\"text\":\"a\\ud800b\""));

        // Act + Assert
        AssertRejected(content);
    }

    // ---- depth ----

    [Fact]
    public void Validate_100BlockLevels_IsAccepted()
    {
        // Arrange
        var content = Nested(100);

        // Act
        var exception = Record.Exception(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Null(exception);
    }

    [Fact]
    public void Validate_101BlockLevels_IsRejected()
    {
        // Arrange
        var content = Nested(101);

        // Act
        var error = Assert.Throws<CustomError>(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Equal(["เนื้อหาของโน้ตซ้อนลึกเกินกำหนด"], error.Messages);
    }

    [Fact]
    public void Validate_VeryDeepDocument_IsRejectedWithoutOverflowingTheStack()
    {
        // Arrange
        var content = Nested(10_000);

        // Act
        var error = Assert.Throws<CustomError>(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.Equal(["เนื้อหาของโน้ตซ้อนลึกเกินกำหนด"], error.Messages);
    }

    [Fact]
    public void Validate_DepthLimitIsASetting()
    {
        // Arrange
        var content = Nested(3);

        // Act
        var accepted = Record.Exception(() => NoteContentValidator.Validate(content, new NoteOptions { MaxBlockDepth = 3 }));
        var rejected = Record.Exception(() => NoteContentValidator.Validate(content, new NoteOptions { MaxBlockDepth = 2 }));

        // Assert
        Assert.Null(accepted);
        Assert.IsType<CustomError>(rejected);
    }

    // ---- size ----

    [Fact]
    public void Validate_ContentExactlyAtTheByteLimit_IsAcceptedAndOneByteMoreIsRejected()
    {
        // Arrange
        var content = Document(Block("paragraph", 1, "\"text\":\"abc\""));
        var bytes = Encoding.UTF8.GetByteCount(content.GetRawText());

        // Act
        var atLimit = Record.Exception(() => NoteContentValidator.Validate(content, new NoteOptions { ContentMaxBytes = bytes }));
        var overLimit = Assert.Throws<CustomError>(
            () => NoteContentValidator.Validate(content, new NoteOptions { ContentMaxBytes = bytes - 1 }));

        // Assert
        Assert.Null(atLimit);
        Assert.Equal(["เนื้อหาของโน้ตใหญ่เกินกำหนด"], overLimit.Messages);
    }

    [Fact]
    public void Validate_SizeIsCountedInUtf8BytesNotCharacters()
    {
        // Arrange: Thai letters take 3 bytes each in UTF-8
        var content = Document(Block("paragraph", 1, "\"text\":\"สวัสดีชาวโลก\""));
        var characters = content.GetRawText().Length;

        // Act
        var error = Assert.Throws<CustomError>(
            () => NoteContentValidator.Validate(content, new NoteOptions { ContentMaxBytes = characters }));

        // Assert
        Assert.Equal(["เนื้อหาของโน้ตใหญ่เกินกำหนด"], error.Messages);
    }

    // ---- messages ----

    [Fact]
    public void Validate_Rejection_DoesNotEchoWhatTheCallerSent()
    {
        // Arrange
        const string marker = "secret-marker-4471";
        var content = Document($"{{\"id\":\"{Id(1)}\",\"type\":\"paragraph\",\"text\":\"{marker}\",\"{marker}\":1}}");

        // Act
        var error = Assert.Throws<CustomError>(() => NoteContentValidator.Validate(content, Defaults));

        // Assert
        Assert.DoesNotContain(marker, error.Message);
        Assert.DoesNotContain(Id(1), error.Message);
    }

    // ---- title ----

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(" \t\n ")]
    public void NormalizeTitle_EmptyOrOnlyWhitespace_BecomesUntitled(string? title)
    {
        // Act
        var result = NoteContentValidator.NormalizeTitle(title, Defaults);

        // Assert
        Assert.Equal("Untitled", result);
    }

    [Fact]
    public void NormalizeTitle_TrimsSurroundingSpacesAndKeepsInnerOnes()
    {
        // Act
        var result = NoteContentValidator.NormalizeTitle("  my  note \n", Defaults);

        // Assert
        Assert.Equal("my  note", result);
    }

    [Fact]
    public void NormalizeTitle_200AsciiCharactersAreAcceptedAnd201AreRejected()
    {
        // Act
        var at = Record.Exception(() => NoteContentValidator.NormalizeTitle(new string('a', 200), Defaults));
        var over = Assert.Throws<CustomError>(() => NoteContentValidator.NormalizeTitle(new string('a', 201), Defaults));

        // Assert
        Assert.Null(at);
        Assert.Equal(["ชื่อโน้ตต้องไม่เกิน 200 ตัวอักษร"], over.Messages);
    }

    [Fact]
    public void NormalizeTitle_ThaiTextIsCountedPerCodePoint()
    {
        // Arrange: each of these is one code point, tone marks and vowels above included
        var at = string.Concat(Enumerable.Repeat("สวัสดี", 33)) + "สว";
        var over = at + "ส";

        // Act
        var accepted = NoteContentValidator.NormalizeTitle(at, Defaults);
        var rejected = Assert.Throws<CustomError>(() => NoteContentValidator.NormalizeTitle(over, Defaults));

        // Assert
        Assert.Equal(at, accepted);
        Assert.Single(rejected.Messages);
    }

    [Fact]
    public void NormalizeTitle_AnEmojiCountsAsOneCharacter()
    {
        // Arrange: each emoji is 2 UTF-16 units, so 200 of them are 400 units
        var at = string.Concat(Enumerable.Repeat("😀", 200));
        var over = at + "😀";

        // Act
        var accepted = NoteContentValidator.NormalizeTitle(at, Defaults);
        var rejected = Assert.Throws<CustomError>(() => NoteContentValidator.NormalizeTitle(over, Defaults));

        // Assert
        Assert.Equal(at, accepted);
        Assert.Single(rejected.Messages);
    }

    [Fact]
    public void NormalizeTitle_LimitIsCountedAfterTrimming()
    {
        // Arrange
        var padded = "  " + new string('a', 200) + "  ";

        // Act
        var result = NoteContentValidator.NormalizeTitle(padded, Defaults);

        // Assert
        Assert.Equal(200, result.Length);
    }

    [Theory]
    [InlineData(0x0000)]
    [InlineData(0xD800)]
    public void NormalizeTitle_CharactersTheDatabaseCannotStore_AreRejected(int badCodeUnit)
    {
        // Act + Assert
        Assert.Throws<CustomError>(() => NoteContentValidator.NormalizeTitle($"a{(char)badCodeUnit}b", Defaults));
    }

    // ---- context ----

    [Fact]
    public void NormalizeContext_Null_BecomesEmptyAndIsNotTrimmed()
    {
        // Act
        var empty = NoteContentValidator.NormalizeContext(null, Defaults);
        var spaced = NoteContentValidator.NormalizeContext("  keep  ", Defaults);

        // Assert
        Assert.Equal("", empty);
        Assert.Equal("  keep  ", spaced);
    }

    [Fact]
    public void NormalizeContext_2000AreAcceptedAnd2001AreRejected()
    {
        // Act
        var at = Record.Exception(() => NoteContentValidator.NormalizeContext(new string('a', 2000), Defaults));
        var over = Assert.Throws<CustomError>(() => NoteContentValidator.NormalizeContext(new string('a', 2001), Defaults));

        // Assert
        Assert.Null(at);
        Assert.Equal(["บริบทของโน้ตต้องไม่เกิน 2000 ตัวอักษร"], over.Messages);
    }

    [Fact]
    public void NormalizeContext_ThaiTextAndEmojiAreCountedPerCodePoint()
    {
        // Arrange
        var thai = string.Concat(Enumerable.Repeat("กำไร", 500));
        var emoji = string.Concat(Enumerable.Repeat("😀", 2000));

        // Act
        var thaiResult = Record.Exception(() => NoteContentValidator.NormalizeContext(thai, Defaults));
        var emojiResult = Record.Exception(() => NoteContentValidator.NormalizeContext(emoji, Defaults));
        var emojiOver = Assert.Throws<CustomError>(() => NoteContentValidator.NormalizeContext(emoji + "😀", Defaults));

        // Assert
        Assert.Null(thaiResult);
        Assert.Null(emojiResult);
        Assert.Single(emojiOver.Messages);
    }

    // ---- helpers ----

    private static void AssertRejected(JsonElement content)
    {
        var error = Assert.Throws<CustomError>(() => NoteContentValidator.Validate(content, Defaults));
        Assert.Equal(["เนื้อหาของโน้ตไม่ถูกต้อง"], error.Messages);
    }

    private static JsonElement Parse(string json) =>
        JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 1_000_000 }).RootElement;

    private static JsonElement Document(params string[] blocks) =>
        Parse($"{{\"schemaVersion\":1,\"blocks\":[{string.Join(",", blocks)}]}}");

    private static string Id(int number) => new Guid(number, 0, 0, new byte[8]).ToString();

    private static string Block(string type, int number, string properties) =>
        $"{{\"id\":\"{Id(number)}\",\"type\":\"{type}\"{(properties.Length == 0 ? "" : "," + properties)}}}";

    // Note: a chain of bullets, each one the only child of the one before, so the document has `levels` block levels
    private static JsonElement Nested(int levels)
    {
        var json = new StringBuilder("{\"schemaVersion\":1,\"blocks\":[");
        for (var level = 1; level <= levels; level++)
        {
            json.Append($"{{\"id\":\"{Id(level)}\",\"type\":\"bullet\",\"text\":\"\",\"children\":[");
        }
        for (var level = 1; level <= levels; level++)
        {
            json.Append("]}");
        }
        json.Append("]}");
        return Parse(json.ToString());
    }
}
