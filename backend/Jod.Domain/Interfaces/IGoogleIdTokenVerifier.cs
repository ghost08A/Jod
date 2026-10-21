using Jod.Domain.Models;

namespace Jod.Domain.Interfaces;

public interface IGoogleIdTokenVerifier
{
    /// <summary>
    /// Checks the signature, audience, issuer and expiry of a Google ID token.
    /// Throws CustomError (Unauthorized) for a token that cannot be used and CustomError (Unavailable)
    /// when Google could not be reached to check it.
    /// </summary>
    Task<GoogleIdentity> VerifyAsync(string credential);
}
