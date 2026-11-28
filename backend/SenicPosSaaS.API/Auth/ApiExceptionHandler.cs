using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.API.Auth;

/// <summary>
/// Turns the application's own exceptions into RFC 7807 responses. Anything else is left to the
/// default handler, which answers 500 without leaking details.
/// </summary>
public class ApiExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;

    public ApiExceptionHandler(IProblemDetailsService problemDetails)
    {
        _problemDetails = problemDetails;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // The last two reach here only from operations that do not retry on their own (e.g. editing
        // an item while it is being sold): the client should reload and try again.
        var (status, title, code, detail) = exception switch
        {
            ConflictException e => (StatusCodes.Status409Conflict, "Conflict", e.Code, e.Message),
            InvalidRequestException e => (StatusCodes.Status400BadRequest, "Bad Request", e.Code, e.Message),
            NotFoundException e => (StatusCodes.Status404NotFound, "Not Found", e.Code, e.Message),
            ConcurrencyException => (StatusCodes.Status409Conflict, "Conflict", ErrorCodes.DataChanged, "The data was changed by someone else. Reload and try again."),
            DuplicateKeyException => (StatusCodes.Status409Conflict, "Conflict", ErrorCodes.DuplicateValue, "A record with the same unique value already exists."),
            _ => (0, string.Empty, string.Empty, string.Empty)
        };
        if (status == 0) return false;

        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };
        // What the web app translates: the name of the error and the values its sentence needs.
        problem.Extensions["code"] = code;
        if (exception is AppException { Parameters.Count: > 0 } app)
            problem.Extensions["params"] = app.Parameters;

        httpContext.Response.StatusCode = status;
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = problem
        });
    }
}
