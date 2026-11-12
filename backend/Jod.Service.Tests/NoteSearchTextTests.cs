using Jod.Service.Helper;

namespace Jod.Service.Tests;

public class NoteSearchTextTests
{
    private const string Id = "11111111-1111-4111-8111-111111111111";

    private static string Doc(string blocks) => $"{{\"schemaVersion\":1,\"blocks\":[{blocks}]}}";

    [Fact]
    public void EmptyDocument_GivesEmptyText() =>
        Assert.Equal("", NoteSearchText.FromContentJson(NoteContentValidator.EmptyContentJson));

    [Fact]
    public void SeveralBlockTypes_AreJoinedWithANewline_AndADividerAddsNothing() =>
        Assert.Equal("หัวข้อ\nbody\ncode()", NoteSearchText.FromContentJson(Doc(
            $"{{\"id\":\"{Id}\",\"type\":\"heading\",\"text\":\"หัวข้อ\",\"level\":1}},"
            + $"{{\"id\":\"{Id}\",\"type\":\"divider\"}},"
            + $"{{\"id\":\"{Id}\",\"type\":\"paragraph\",\"text\":\"body\"}},"
            + $"{{\"id\":\"{Id}\",\"type\":\"code\",\"text\":\"code()\",\"language\":\"cs\"}}")));

    [Fact]
    public void NestedChildren_AreFoundAtAnyDepth_ParentBeforeItsChildren() =>
        Assert.Equal("a\na1\na1x\nb", NoteSearchText.FromContentJson(Doc(
            $"{{\"id\":\"{Id}\",\"type\":\"bullet\",\"text\":\"a\",\"children\":["
            + $"{{\"id\":\"{Id}\",\"type\":\"bullet\",\"text\":\"a1\",\"children\":[{{\"id\":\"{Id}\",\"type\":\"paragraph\",\"text\":\"a1x\"}}]}}]}},"
            + $"{{\"id\":\"{Id}\",\"type\":\"paragraph\",\"text\":\"b\"}}")));

    [Fact]
    public void ChildrenWrittenBeforeText_StillGiveTheParentTextFirst_LikeJsonb() =>
        Assert.Equal("parent\nchild", NoteSearchText.FromContentJson(Doc(
            $"{{\"children\":[{{\"text\":\"child\",\"type\":\"paragraph\"}}],\"type\":\"bullet\",\"text\":\"parent\"}}")));

    [Fact]
    public void ATextThatIsNotAString_IsIgnored() =>
        Assert.Equal("kept", NoteSearchText.FromContentJson(
            "{\"schemaVersion\":1,\"blocks\":[{\"text\":5},{\"text\":null},{\"text\":[\"x\"]},{\"text\":true},{\"text\":\"kept\"}]}"));

    [Theory]
    [InlineData("not json")]
    [InlineData("")]
    [InlineData("{\"blocks\":[{\"text\":\"x\"")]
    public void BadJson_GivesEmptyText(string json) => Assert.Equal("", NoteSearchText.FromContentJson(json));

    [Fact]
    public void ADeeplyNestedDocument_DoesNotOverflow()
    {
        var depth = 400;
        var json = string.Concat(Enumerable.Repeat("{\"text\":\"t\",\"children\":[", depth)) + string.Concat(Enumerable.Repeat("]}", depth));

        var text = NoteSearchText.FromContentJson(json);

        Assert.Equal(depth, text.Split('\n').Length);
    }
}
