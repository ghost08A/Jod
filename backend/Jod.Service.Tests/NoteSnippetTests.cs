using Jod.Service.Helper;

namespace Jod.Service.Tests;

public class NoteSnippetTests
{
    private static string Filler(int length) => new('.', length);

    [Fact]
    public void TextShorterThanTheSnippet_IsReturnedWhole() =>
        Assert.Equal("short text", NoteSnippet.Create("short text", "text"));

    [Fact]
    public void MatchAtTheStart_StartsTheSnippetAtTheStart()
    {
        var text = "needle" + Filler(300);

        var snippet = NoteSnippet.Create(text, "needle");

        Assert.Equal(100, snippet.Length);
        Assert.StartsWith("needle", snippet);
    }

    [Fact]
    public void MatchInTheMiddle_IsInsideWithTextOnBothSides()
    {
        var text = Filler(300) + "needle" + Filler(300);

        var snippet = NoteSnippet.Create(text, "needle");

        Assert.Equal(100, snippet.Length);
        Assert.Contains("needle", snippet);
        Assert.StartsWith(".", snippet);
        Assert.EndsWith(".", snippet);
    }

    [Fact]
    public void MatchAtTheEnd_EndsTheSnippetAtTheEnd()
    {
        var text = Filler(300) + "needle";

        var snippet = NoteSnippet.Create(text, "needle");

        Assert.Equal(100, snippet.Length);
        Assert.EndsWith("needle", snippet);
    }

    [Fact]
    public void TheMatchIsCaseInsensitive_AndKeepsTheTextsOwnCase() =>
        Assert.Contains("NeEdLe", NoteSnippet.Create(Filler(300) + "NeEdLe" + Filler(300), "needle"));

    [Fact]
    public void OnlyTheFirstMatchIsUsed()
    {
        var text = "first" + Filler(300) + "second";

        Assert.StartsWith("first", NoteSnippet.Create(text, "first"));
        Assert.DoesNotContain("second", NoteSnippet.Create(text, "first"));
    }

    [Fact]
    public void NoMatchInTheText_GivesTheStartOfTheText()
    {
        var text = "start" + Filler(300);

        var snippet = NoteSnippet.Create(text, "title-only");

        Assert.Equal(100, snippet.Length);
        Assert.StartsWith("start", snippet);
    }

    [Fact]
    public void NoMatchInEmptyText_GivesEmpty() => Assert.Equal("", NoteSnippet.Create("", "x"));

    [Fact]
    public void ThaiText_KeepsTheMatchInside()
    {
        var text = string.Concat(Enumerable.Repeat("สวัสดีชาวโลก", 30)) + "ประเทศไทย" + string.Concat(Enumerable.Repeat("สวัสดีชาวโลก", 30));

        var snippet = NoteSnippet.Create(text, "ไทย");

        Assert.Contains("ไทย", snippet);
        Assert.InRange(snippet.Length, 100, 101);
    }

    [Fact]
    public void AMatchLongerThanTheSnippet_IsKeptWhole()
    {
        var match = new string('a', 150);

        Assert.Equal(match, NoteSnippet.Create(Filler(200) + match + Filler(200), match));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    public void ASurrogatePair_IsNeverCutInHalf(int shift)
    {
        // Arrange: emoji (2 chars each) everywhere, so any window edge may land inside a pair
        var emoji = "\U0001F600";
        var text = string.Concat(Enumerable.Repeat(emoji, 120)) + new string('x', shift) + "needle" + string.Concat(Enumerable.Repeat(emoji, 120));

        var snippet = NoteSnippet.Create(text, "needle");

        Assert.Contains("needle", snippet);
        Assert.False(char.IsLowSurrogate(snippet[0]));
        Assert.False(char.IsHighSurrogate(snippet[^1]));
    }
}
