using Microsoft.AspNetCore.Mvc;

namespace SenicPosSaaS.API.Auth;

public static class CodedProblems
{
    /// <summary>
    /// An RFC 7807 answer that also names the error (see <c>ErrorCodes</c>), for the errors a
    /// controller reports itself instead of throwing.
    /// </summary>
    public static ObjectResult CodedProblem(this ControllerBase controller, int status, string code, string detail, params (string Name, object? Value)[] parameters)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (parameters.Length > 0)
            extensions["params"] = parameters.ToDictionary(p => p.Name, p => p.Value);

        var title = status switch
        {
            StatusCodes.Status400BadRequest => "Bad Request",
            StatusCodes.Status401Unauthorized => "Unauthorized",
            StatusCodes.Status404NotFound => "Not Found",
            StatusCodes.Status409Conflict => "Conflict",
            StatusCodes.Status429TooManyRequests => "Too Many Requests",
            _ => null
        };
        return controller.Problem(detail: detail, statusCode: status, title: title, extensions: extensions);
    }
}
