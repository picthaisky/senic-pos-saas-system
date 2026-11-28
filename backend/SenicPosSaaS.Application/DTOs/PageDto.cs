namespace SenicPosSaaS.Application.DTOs;

/// <summary>One page of a list: what GET /api/inventory, /customers and /orders return when asked with <c>page</c>.</summary>
public class PageDto<T>
{
    public IReadOnlyList<T> Items { get; set; } = [];
    /// <summary>How many records match the filters in total.</summary>
    public int Total { get; set; }
    /// <summary>Starts at 1.</summary>
    public int Page { get; set; }
    public int PageSize { get; set; }
}

/// <summary>A page of orders, with the completed sales of the whole filtered list.</summary>
public class OrderPageDto : PageDto<Order.OrderDto>
{
    public int CompletedCount { get; set; }
    public decimal CompletedTotal { get; set; }
}

/// <summary>Brings the page a client asked for into the allowed range.</summary>
public readonly record struct PageRequest(int Page, int PageSize)
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 200;

    public int Skip => (Page - 1) * PageSize;

    public static PageRequest Normalize(int page, int pageSize) =>
        new(Math.Max(1, page), Math.Clamp(pageSize, 1, MaxPageSize));
}
