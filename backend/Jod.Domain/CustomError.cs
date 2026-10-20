using Jod.Domain.Enums;

namespace Jod.Domain;

public class CustomError : Exception
{
    public List<string> Messages { get; } = [];
    public ErrorKind Kind { get; init; } = ErrorKind.Validation;
    public override string Message => string.Join(", ", Messages);

    public CustomError() { }
    public CustomError(string message, ErrorKind kind = ErrorKind.Validation)
    {
        Messages.Add(message);
        Kind = kind;
    }

    public void Add(string message) => Messages.Add(message);

    public void ThrowIfAny()
    {
        if (Messages.Count > 0) throw this;
    }
}
