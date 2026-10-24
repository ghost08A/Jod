namespace Jod.Domain.Enums;

/// <summary>
/// What kind of failure a CustomError reports. The Web layer turns it into an HTTP status.
/// </summary>
public enum ErrorKind
{
    Validation,
    Unauthorized,
    Forbidden,
    Conflict,
    NotFound,
    Unavailable,
}
