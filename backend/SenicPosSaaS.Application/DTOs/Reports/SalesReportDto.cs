using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Reports;

/// <summary>GET /api/reports/sales. Completed bills only; days are the shop's calendar days.</summary>
public class SalesReportDto
{
    /// <summary>First and last day covered, yyyy-MM-dd.</summary>
    public string From { get; set; } = string.Empty;
    public string To { get; set; } = string.Empty;

    public SalesReportTotalsDto Totals { get; set; } = new();

    /// <summary>One entry per day of the period, including days without sales.</summary>
    public List<SalesByDayDto> ByDay { get; set; } = new();

    /// <summary>Best seller first. Amounts are the lines after their own discounts.</summary>
    public List<SalesByItemDto> ByItem { get; set; } = new();
    public List<SalesByCategoryDto> ByCategory { get; set; } = new();
    public List<SalesByCashierDto> ByCashier { get; set; } = new();
    public List<SalesByPaymentMethodDto> ByPaymentMethod { get; set; } = new();
}

public class SalesReportTotalsDto
{
    public int OrderCount { get; set; }
    /// <summary>What customers paid.</summary>
    public decimal NetSales { get; set; }
    /// <summary>VAT charged or contained in <see cref="NetSales"/>.</summary>
    public decimal TaxAmount { get; set; }
    /// <summary>Line discounts, bill discounts and points used.</summary>
    public decimal Discounts { get; set; }
    public decimal AverageOrderValue { get; set; }
    /// <summary>Cancelled bills of the period; they are in none of the other figures.</summary>
    public int CancelledCount { get; set; }

    /// <summary>What the goods sold cost the shop, for the lines whose cost was recorded.</summary>
    public decimal Cost { get; set; }
    /// <summary>
    /// Sales without VAT and after every discount, less <see cref="Cost"/>; only over the lines
    /// whose cost was recorded.
    /// </summary>
    public decimal GrossProfit { get; set; }
    /// <summary><see cref="GrossProfit"/> as a percentage of the sales it is worked out on; 0 without such sales.</summary>
    public decimal GrossMarginPercent { get; set; }
    /// <summary>
    /// Sales (without VAT) of lines sold before costs were recorded. They are in neither
    /// <see cref="Cost"/> nor <see cref="GrossProfit"/>; above 0, the profit covers only part of the period.
    /// </summary>
    public decimal SalesWithoutCost { get; set; }
}

public class SalesByDayDto
{
    public string Date { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal NetSales { get; set; }
}

public class SalesByItemDto
{
    public Guid InventoryItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public int Quantity { get; set; }
    public decimal Amount { get; set; }
    /// <summary>Null when no unit of the item was sold with a recorded cost.</summary>
    public decimal? Cost { get; set; }
    /// <summary>The item's share of the bills without VAT and after every discount, less its cost. Null like <see cref="Cost"/>.</summary>
    public decimal? Profit { get; set; }
}

public class SalesByCategoryDto
{
    /// <summary>Null for items without a category.</summary>
    public string? Category { get; set; }
    public int Quantity { get; set; }
    public decimal Amount { get; set; }
    public decimal? Cost { get; set; }
    public decimal? Profit { get; set; }
}

public class SalesByCashierDto
{
    /// <summary>Null for bills made before the seller was recorded.</summary>
    public Guid? UserId { get; set; }
    public string? Name { get; set; }
    public int OrderCount { get; set; }
    public decimal NetSales { get; set; }
}

public class SalesByPaymentMethodDto
{
    public PaymentMethod PaymentMethod { get; set; }
    public int OrderCount { get; set; }
    public decimal NetSales { get; set; }
}
