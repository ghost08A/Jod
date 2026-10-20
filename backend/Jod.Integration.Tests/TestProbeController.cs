using Microsoft.AspNetCore.Mvc;

namespace Jod.Integration.Tests;

// Note: test-only endpoint with no [AllowAnonymous], used to prove new endpoints require sign-in by default
[ApiController]
[Route("api/test-probe")]
public class TestProbeController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok();
}
