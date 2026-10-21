using System.Security.Cryptography;
using Jod.Domain;
using Jod.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace Web.Jod.Middleware;

/// <summary>
/// The single place that decides what an error response looks like (problem+json, Thai text, reference).
/// </summary>
public static class ErrorResponses
{
    // No 0/O/1/I so a reference read out loud or copied by hand is not misread
    private const string ReferenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int ReferenceLength = 8;

    public static string NewReference() =>
        RandomNumberGenerator.GetString(ReferenceAlphabet, ReferenceLength);

    public static int StatusFor(ErrorKind kind) => kind switch
    {
        ErrorKind.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorKind.Forbidden => StatusCodes.Status403Forbidden,
        ErrorKind.Conflict => StatusCodes.Status409Conflict,
        ErrorKind.Unavailable => StatusCodes.Status503ServiceUnavailable,
        _ => StatusCodes.Status400BadRequest,
    };

    public static ProblemDetails Create(int status, string reference, IReadOnlyList<string>? errors)
    {
        var (title, detail) = Describe(status);
        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };
        problem.Extensions["reference"] = reference;
        if (errors is { Count: > 0 })
        {
            problem.Extensions["errors"] = errors;
        }
        return problem;
    }

    public static Task WriteAsync(HttpContext context, ProblemDetails problem)
    {
        context.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        return context.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json");
    }

    /// <summary>
    /// Used by [ApiController] when the request cannot be bound or validated. It throws a CustomError
    /// so these failures take the same path (format, reference, log) as every other error.
    /// </summary>
    public static IActionResult ThrowForInvalidModelState(ActionContext context)
    {
        // Note: ModelState is ignored on purpose. Its messages are framework text (English, with
        // JSON paths and field names). Messages the user should see come from Services as CustomError.
        throw new CustomError("ข้อมูลที่ส่งมาไม่ถูกต้อง");
    }

    private static (string Title, string Detail) Describe(int status) => status switch
    {
        StatusCodes.Status400BadRequest => ("ข้อมูลไม่ถูกต้อง", "ตรวจสอบข้อมูลที่กรอกแล้วลองอีกครั้ง"),
        StatusCodes.Status401Unauthorized => ("ต้องเข้าสู่ระบบ", "กรุณาเข้าสู่ระบบก่อนทำรายการนี้"),
        StatusCodes.Status403Forbidden => ("ไม่มีสิทธิ์", "คุณไม่มีสิทธิ์ทำรายการนี้"),
        StatusCodes.Status404NotFound => ("ไม่พบข้อมูล", "ไม่พบสิ่งที่ต้องการ"),
        StatusCodes.Status405MethodNotAllowed => ("ไม่รองรับคำขอนี้", "ระบบไม่รองรับวิธีเรียกใช้งานนี้"),
        StatusCodes.Status409Conflict => ("ข้อมูลขัดแย้ง", "ข้อมูลขัดแย้งกับที่มีอยู่แล้ว"),
        StatusCodes.Status429TooManyRequests => ("ส่งคำขอถี่เกินไป", "กรุณารอสักครู่แล้วลองใหม่"),
        StatusCodes.Status503ServiceUnavailable => ("บริการภายนอกไม่พร้อมใช้งาน", "ติดต่อบริการภายนอกไม่ได้ชั่วคราว ลองอีกครั้ง"),
        >= 500 => ("เกิดข้อผิดพลาดในระบบ", "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง หากยังไม่หายให้แจ้งผู้ดูแลพร้อมรหัสอ้างอิง"),
        _ => ("เกิดข้อผิดพลาด", "ไม่สามารถทำรายการได้ ลองใหม่อีกครั้ง"),
    };
}
