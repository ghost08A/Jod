using Jod.Service.Helper;

namespace Jod.Service.Tests;

public class NoteEmptinessTests
{
    private const string Id = "11111111-1111-4111-8111-111111111111";

    private static string Doc(string blocks) => $"{{\"schemaVersion\":1,\"blocks\":[{blocks}]}}";

    [Fact]
    public void NoBlocks_IsEmpty() => Assert.True(NoteEmptiness.IsEmptyDocument(NoteContentValidator.EmptyContentJson));

    [Fact]
    public void SingleParagraphWithNoText_IsEmpty() =>
        Assert.True(NoteEmptiness.IsEmptyDocument(Doc($"{{\"id\":\"{Id}\",\"type\":\"paragraph\",\"text\":\"\"}}")));

    [Theory]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"paragraph\",\"text\":\"a\"}")]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"paragraph\",\"text\":\" \"}")]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"paragraph\",\"text\":\"\"},{\"id\":\"22222222-2222-4222-8222-222222222222\",\"type\":\"paragraph\",\"text\":\"\"}")]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"heading\",\"text\":\"\",\"level\":1}")]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"divider\"}")]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"paragraph\",\"text\":\"\",\"children\":[]}")]
    [InlineData("{\"id\":\"" + Id + "\",\"type\":\"paragraph\"}")]
    [InlineData("\"paragraph\"")]
    public void AnythingWritten_IsNotEmpty(string blocks) =>
        Assert.False(NoteEmptiness.IsEmptyDocument(Doc(blocks)));

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("{\"blocks\":[]}")]
    [InlineData("{\"schemaVersion\":2,\"blocks\":[]}")]
    [InlineData("{\"schemaVersion\":1,\"blocks\":{}}")]
    [InlineData("{\"schemaVersion\":1,\"blocks\":[],\"extra\":1}")]
    public void WrongShape_IsNotEmpty(string json) => Assert.False(NoteEmptiness.IsEmptyDocument(json));
}
