namespace SenicPosSaaS.Domain.Common;

/// <summary>
/// The order of a list, as a client asks for it: a field name, with a leading "-" for
/// descending ("-price").
/// </summary>
public readonly record struct SortSpec(string Field, bool Descending)
{
    /// <summary>
    /// Null or blank text means "the list's own default order" (<paramref name="sort"/> is null).
    /// Returns false when the field is not one of <paramref name="allowed"/>.
    /// </summary>
    public static bool TryParse(string? text, IReadOnlyCollection<string> allowed, out SortSpec? sort)
    {
        sort = null;
        if (string.IsNullOrWhiteSpace(text)) return true;

        var trimmed = text.Trim();
        var descending = trimmed.StartsWith('-');
        var name = descending ? trimmed[1..] : trimmed;
        var field = allowed.FirstOrDefault(f => string.Equals(f, name, StringComparison.OrdinalIgnoreCase));
        if (field == null) return false;

        sort = new SortSpec(field, descending);
        return true;
    }
}

/// <summary>The fields each list can be sorted by. The first is the default order.</summary>
public static class SortFields
{
    public static readonly IReadOnlyList<string> Inventory = ["name", "sku", "category", "price", "quantity", "createdAt"];
    public static readonly IReadOnlyList<string> Customers = ["name", "loyaltyPoints", "createdAt"];
    public static readonly IReadOnlyList<string> Orders = ["createdAt", "netAmount", "orderNumber"];
}

/// <summary>One page of a list, with the size of the whole list.</summary>
public record PagedList<T>(IReadOnlyList<T> Items, int Total);

/// <summary>
/// A page of orders. The completed figures cover every order matching the filters, not only the
/// ones on this page.
/// </summary>
public record OrderPagedList(IReadOnlyList<Entities.Order> Items, int Total, int CompletedCount, decimal CompletedTotal);
