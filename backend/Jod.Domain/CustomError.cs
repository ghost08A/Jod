namespace Jod.Domain;

public class CustomError : Exception
{
    public List<string> Messages { get; } = [];
    public override string Message => string.Join(", ", Messages);

    public CustomError() { }
    public CustomError(string message) => Messages.Add(message);

    public void Add(string message) => Messages.Add(message);

    public void ThrowIfAny()
    {
        if (Messages.Count > 0) throw this;
    }
}
