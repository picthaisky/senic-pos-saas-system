namespace SenicPosSaaS.Application.DTOs.Dashboard;

public class DashboardSummaryDto
{
    public decimal TotalSales { get; set; }
    public int OrderCount { get; set; }
    public decimal AverageOrderValue { get; set; }
    public int LowStockCount { get; set; }

    /// <summary>One entry per day of the requested range, including days without sales.</summary>
    public List<DailySalesDto> SalesByDay { get; set; } = new();

    /// <summary>The five best-selling items by revenue.</summary>
    public List<TopItemDto> TopItems { get; set; } = new();
}

public class DailySalesDto
{
    /// <summary>Calendar day in the shop's time zone, formatted yyyy-MM-dd.</summary>
    public string Date { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public int OrderCount { get; set; }
}

public class TopItemDto
{
    public Guid InventoryItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Total { get; set; }
}
