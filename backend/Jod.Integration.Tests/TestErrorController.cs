using System.ComponentModel.DataAnnotations;
using Jod.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jod.Integration.Tests;

// Note: test-only endpoints. JodWebFactory adds this assembly to the app so errors can be provoked on demand.
[AllowAnonymous]
[ApiController]
[Route("api/test-errors")]
public class TestErrorController : ControllerBase
{
    public const string UnexpectedErrorMessage = "unexpected-error-message-marker";

    public class NameRequest
    {
        [Required]
        public string? Name { get; set; }
    }

    [HttpGet("business-error")]
    public IActionResult BusinessError()
    {
        var error = new CustomError("ข้อความทดสอบข้อที่ 1");
        error.Add("ข้อความทดสอบข้อที่ 2");
        throw error;
    }

    [HttpGet("unexpected-error")]
    public IActionResult UnexpectedError() =>
        throw new InvalidOperationException(UnexpectedErrorMessage);

    [HttpPost("validate")]
    public IActionResult Validate(NameRequest request) => Ok();
}
