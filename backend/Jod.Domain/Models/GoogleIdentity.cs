namespace Jod.Domain.Models;

/// <summary>
/// What Jod reads from a Google ID token after the token passed verification.
/// HostedDomain is Google's "hd" claim, present only for Google Workspace accounts.
/// </summary>
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? HostedDomain);
