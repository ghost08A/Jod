namespace Jod.Service.Helper;

/// <summary>
/// The short piece of a note's plain text shown under a search result: about 100 characters around the first match,
/// with the match inside. When the text does not hold the query (the note matched by its title) it is the start of the text.
/// The match is not marked here; the page does that. Never cuts a surrogate pair in half.
/// </summary>
public static class NoteSnippet
{
    public const int Length = 100;

    public static string Create(string text, string query)
    {
        var matchAt = query.Length == 0 ? -1 : text.IndexOf(query, StringComparison.OrdinalIgnoreCase);
        // Note: a match longer than the snippet is kept whole, so the snippet is never shorter than the match
        var size = Math.Max(Length, matchAt < 0 ? 0 : query.Length);
        if (text.Length <= size)
        {
            return text;
        }
        var start = matchAt < 0 ? 0 : Math.Clamp(matchAt - (size - query.Length) / 2, 0, text.Length - size);
        var end = start + size;
        if (start > 0 && char.IsLowSurrogate(text[start]))
        {
            start--;
        }
        if (end < text.Length && char.IsLowSurrogate(text[end]))
        {
            end++;
        }
        return text[start..end];
    }
}
