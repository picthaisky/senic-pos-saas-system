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
        var (status, title, detail) = exception switch
        {
            ConflictException => (StatusCodes.Status409Conflict, "Conflict", exception.Message),
            NotFoundException => (StatusCodes.Status404NotFound, "Not Found", exception.Message),
            ConcurrencyException => (StatusCodes.Status409Conflict, "Conflict", "The data was changed by someone else. Reload and try again."),
            DuplicateKeyException => (StatusCodes.Status409Conflict, "Conflict", "A record with the same unique value already exists."),
            _ => (0, string.Empty, string.Empty)
        };
        if (status == 0) return false;

        httpContext.Response.StatusCode = status;
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails { Status = status, Title = title, Detail = detail }
        });
    }
}
