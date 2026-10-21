namespace Jod.Domain.RequestModels;

public class GoogleSignInRequestModel
{
    /// <summary>The Google ID token the sign-in button gave the browser. Nothing else from the browser is trusted.</summary>
    public required string Credential { get; set; }
}
