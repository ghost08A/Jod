using Jod.Domain;

namespace Web.Jod.Middleware;

/// <summary>
/// Outermost middleware. Turns every failure into the same problem+json response with a
/// reference, and writes one log line with that reference. It never logs request content,
/// headers or exception messages, because those can hold emails, passwords or tokens.
/// </summary>
public class ApiExceptionHandler(RequestDelegate next, ILogger<ApiExceptionHandler> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Note: the client went away, nobody is left to read a response
            return;
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            // Note: once the response has started it cannot be replaced, so the exception is left to the server
            context.Response.Clear();
            await HandleExceptionAsync(context, exception);
            return;
        }

        if (HasNoBody(context.Response))
        {
            // Framework answers such as 401, 404 and 405 are empty by default
            await WriteProblemAsync(context, context.Response.StatusCode, errors: null, errorType: "HttpStatus");
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (exception is CustomError customError)
        {
            return WriteProblemAsync(context, ErrorResponses.StatusFor(customError.Kind), customError.Messages, nameof(CustomError));
        }

        // Note: Message is deliberately left out, the type and stack trace are enough to find the cause
        return WriteProblemAsync(context, StatusCodes.Status500InternalServerError, errors: null,
            errorType: exception.GetType().FullName ?? "Unknown", stackTrace: exception.StackTrace);
    }

    private async Task WriteProblemAsync(
        HttpContext context, int status, IReadOnlyList<string>? errors, string errorType, string? stackTrace = null)
    {
        var reference = ErrorResponses.NewReference();
        var endpoint = context.GetEndpoint() is RouteEndpoint route
            ? $"{context.Request.Method} {route.RoutePattern.RawText}"
            : "no matching endpoint";

        logger.Log(
            status >= StatusCodes.Status500InternalServerError ? LogLevel.Error : LogLevel.Information,
            "Request failed {Reference} {Status} {ErrorType} at {Endpoint} {StackTrace}",
            reference, status, errorType, endpoint, stackTrace);

        await ErrorResponses.WriteAsync(context, ErrorResponses.Create(status, reference, errors));
    }

    private static bool HasNoBody(HttpResponse response) =>
        response.StatusCode >= StatusCodes.Status400BadRequest
        && !response.HasStarted
        && response.ContentLength is null
        && response.ContentType is null;
}
