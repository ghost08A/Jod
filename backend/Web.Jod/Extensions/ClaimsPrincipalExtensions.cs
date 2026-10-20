using System.Security.Claims;
using Jod.Domain;
using Jod.Domain.Enums;

namespace Web.Jod.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// The id of the signed-in user, read from the access token's "sub" claim.
    /// Call it only on endpoints that require sign-in.
    /// </summary>
    public static Guid GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var userId)
            ? userId
            : throw new CustomError("ต้องเข้าสู่ระบบ", ErrorKind.Unauthorized);
}
