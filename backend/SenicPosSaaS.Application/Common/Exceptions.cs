namespace SenicPosSaaS.Application.Common;

/// <summary>
/// An error the API explains to the person using it. <see cref="Code"/> is one of
/// <see cref="ErrorCodes"/>; the message is the English sentence, kept for logs and for clients
/// that do not know the code.
/// </summary>
public abstract class AppException : Exception
{
    protected AppException(string code, string message, (string Name, object? Value)[] parameters) : base(message)
    {
        Code = code;
        Parameters = parameters.ToDictionary(p => p.Name, p => p.Value);
    }

    public string Code { get; }

    /// <summary>The values the sentence needs, e.g. the name of the item that ran out.</summary>
    public IReadOnlyDictionary<string, object?> Parameters { get; }
}

/// <summary>The request is valid but clashes with current data (HTTP 409), e.g. not enough stock.</summary>
public class ConflictException : AppException
{
    public ConflictException(string code, string message, params (string Name, object? Value)[] parameters) : base(code, message, parameters) { }
}

/// <summary>The request asks for something that makes no sense (HTTP 400), e.g. a discount larger than the bill.</summary>
public class InvalidRequestException : AppException
{
    public InvalidRequestException(string code, string message, params (string Name, object? Value)[] parameters) : base(code, message, parameters) { }
}

/// <summary>Something the request refers to does not exist for this tenant (HTTP 404).</summary>
public class NotFoundException : AppException
{
    public NotFoundException(string code, string message, params (string Name, object? Value)[] parameters) : base(code, message, parameters) { }
}
