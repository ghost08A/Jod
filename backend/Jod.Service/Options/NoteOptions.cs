namespace Jod.Service.Options;

/// <summary>Limits on one note. The defaults are the product limits; they are settings so they can be tuned.</summary>
public class NoteOptions
{
    public const string SectionName = "Notes";

    /// <summary>Counted in Unicode code points, not UTF-16 characters.</summary>
    public int TitleMaxLength { get; set; } = 200;

    /// <summary>Counted in Unicode code points, not UTF-16 characters.</summary>
    public int ContextMaxLength { get; set; } = 2000;

    /// <summary>Size of the content as raw JSON text in UTF-8.</summary>
    public int ContentMaxBytes { get; set; } = 1_048_576;

    /// <summary>Most block levels one above the other (a block inside a block counts as a second level).</summary>
    public int MaxBlockDepth { get; set; } = 100;
}
