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
}

public class SalesByCategoryDto
{
    /// <summary>Null for items without a category.</summary>
    public string? Category { get; set; }
    public int Quantity { get; set; }
    public decimal Amount { get; set; }
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
