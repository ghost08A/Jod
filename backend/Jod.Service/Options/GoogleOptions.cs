namespace Jod.Service.Options;

public class GoogleOptions
{
    public const string SectionName = "Google";

    // Note: the Client ID is not a secret, but the example settings file ships this prefix so an unedited copy is refused at startup
    public const string PlaceholderPrefix = "REPLACE_WITH";

    public string ClientId { get; set; } = "";
}
