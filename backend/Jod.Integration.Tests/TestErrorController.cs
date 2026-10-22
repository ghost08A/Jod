using System.ComponentModel.DataAnnotations;
using Jod.Domain;
using Jod.Domain.Enums;
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

    public const string ConflictPayloadMarker = "conflict-payload-marker-7731";

    // Note: same nesting shape as a Block document, so JSON depth limits are tested the way notes will meet them
    public class TestBlock
    {
        public List<TestBlock> Children { get; set; } = [];
    }

    public class TestBlocksRequest
    {
        public List<TestBlock> Blocks { get; set; } = [];
    }

    [HttpGet("conflict-with-payload")]
    public IActionResult ConflictWithPayload() =>
        throw new CustomError("ข้อมูลถูกแก้จากที่อื่นแล้ว", ErrorKind.Conflict)
        {
            Payload = new { version = 7, title = ConflictPayloadMarker, children = new[] { new { version = 1 } } },
        };

    [HttpGet("conflict-without-payload")]
    public IActionResult ConflictWithoutPayload() =>
        throw new CustomError("ข้อมูลขัดแย้ง", ErrorKind.Conflict);

    [HttpPost("blocks")]
    public IActionResult Blocks(TestBlocksRequest request) => Ok();

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
