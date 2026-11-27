namespace SenicPosSaaS.Domain.Common;

/// <summary>
/// A row being saved was changed or deleted by someone else since it was read. Nothing was
/// saved. The usual response is to discard the pending changes, read again and retry.
/// </summary>
public class ConcurrencyException : Exception
{
    public ConcurrencyException(string message, Exception? innerException = null) : base(message, innerException) { }
}

/// <summary>
/// Saving would have created a second row with a value that must be unique (for example the
/// same SKU, or the same client order id sent twice at once). Nothing was saved.
/// </summary>
public class DuplicateKeyException : Exception
{
    public DuplicateKeyException(string message, Exception? innerException = null) : base(message, innerException) { }
}
