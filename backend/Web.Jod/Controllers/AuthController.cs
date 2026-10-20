using Jod.Domain.Interfaces;
using Jod.Domain.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Web.Jod.Extensions;

namespace Web.Jod.Controllers;

[ApiController]
[Route("api")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("auth/register")]
    public async Task<IActionResult> Register(RegisterRequestModel request) =>
        StatusCode(StatusCodes.Status201Created, await authService.RegisterAsync(request));

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("auth/login")]
    public async Task<IActionResult> Login(LoginRequestModel request) =>
        Ok(await authService.LoginAsync(request));

    [HttpGet("me")]
    public async Task<IActionResult> Me() =>
        Ok(await authService.GetUserAsync(User.GetUserId()));
}
