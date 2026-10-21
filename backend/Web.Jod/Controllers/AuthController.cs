using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.Models;
using Jod.Domain.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Web.Jod.Extensions;

namespace Web.Jod.Controllers;

[ApiController]
[Route("api")]
public class AuthController(IAuthService authService, IWebHostEnvironment environment) : ControllerBase
{
    private const string RefreshCookieName = "jod_refresh";
    private const string RefreshCookiePath = "/api/auth";

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("auth/google")]
    public async Task<IActionResult> SignInWithGoogle(GoogleSignInRequestModel request)
    {
        RequireRequestedWithHeader();
        var session = await authService.SignInWithGoogleAsync(request);
        SetRefreshCookie(session);
        return Ok(session.Result);
    }

    [AllowAnonymous]
    [EnableRateLimiting("refresh")]
    [HttpPost("auth/refresh")]
    public async Task<IActionResult> Refresh()
    {
        RequireRequestedWithHeader();
        var session = await authService.RefreshAsync(Request.Cookies[RefreshCookieName]);
        SetRefreshCookie(session);
        return Ok(session.Result);
    }

    [AllowAnonymous]
    [HttpPost("auth/logout")]
    public async Task<IActionResult> Logout()
    {
        RequireRequestedWithHeader();
        await authService.LogoutAsync(Request.Cookies[RefreshCookieName]);
        Response.Cookies.Delete(RefreshCookieName, CreateCookieOptions(expires: null));
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me() =>
        Ok(await authService.GetUserAsync(User.GetUserId()));

    // Note: a page on another site cannot add a custom header to a cross-site request without the
    // browser asking this server first, so requiring it blocks forged requests that ride on the cookie
    private void RequireRequestedWithHeader()
    {
        if (Request.Headers["X-Requested-With"] != "jod")
        {
            throw new CustomError("คำขอไม่ถูกต้อง", ErrorKind.Forbidden);
        }
    }

    private void SetRefreshCookie(AuthSessionModel session) =>
        Response.Cookies.Append(RefreshCookieName, session.RefreshToken, CreateCookieOptions(session.RefreshTokenExpiresAt));

    private CookieOptions CreateCookieOptions(DateTimeOffset? expires) => new()
    {
        // Note: HttpOnly keeps the token away from page scripts. Strict plus the narrow Path means the
        // browser sends it only to /api/auth/* and only from this site.
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
        Path = RefreshCookiePath,
        Expires = expires,
        // Note: Secure everywhere except local development, where plain http://localhost is normal
        Secure = !environment.IsDevelopment() || Request.IsHttps,
        IsEssential = true,
    };
}
