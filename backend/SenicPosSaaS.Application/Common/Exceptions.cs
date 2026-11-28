namespace SenicPosSaaS.Application.Common;

/// <summary>The request is valid but clashes with current data (HTTP 409), e.g. not enough stock.</summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}

/// <summary>The request asks for something that makes no sense (HTTP 400), e.g. a discount larger than the bill.</summary>
public class InvalidRequestException : Exception
{
    public InvalidRequestException(string message) : base(message) { }
}

/// <summary>Something the request refers to does not exist for this tenant (HTTP 404).</summary>
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}
