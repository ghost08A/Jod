using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Jod.Service.Options;

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public const int MinimumSigningKeyBytes = 32;

    // Note: the example settings file ships this prefix so a copied-but-unedited key is refused at startup
    public const string PlaceholderPrefix = "REPLACE_WITH";

    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int ClockSkewSeconds { get; set; } = 30;

    public SymmetricSecurityKey CreateSigningKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}
