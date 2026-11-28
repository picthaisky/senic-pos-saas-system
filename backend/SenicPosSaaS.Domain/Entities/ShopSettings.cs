using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Entities;

/// <summary>
/// What a shop decides for itself: who it is on a receipt, how its prices relate to VAT, and
/// how customers earn points. One row per tenant; a tenant without a row has the defaults.
/// </summary>
public class ShopSettings : TenantEntity
{
    public const decimal DefaultVatRatePercent = 7;

    /// <summary>Printed at the top of receipts.</summary>
    public string ShopName { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }

    /// <summary>The 13-digit taxpayer number; needed on a tax invoice.</summary>
    public string? TaxId { get; set; }

    /// <summary>"Head office" or the branch number, as registered for VAT.</summary>
    public string? Branch { get; set; }

    /// <summary>A shop charges no VAT until it says it is registered.</summary>
    public VatMode VatMode { get; set; } = VatMode.None;
    public decimal VatRatePercent { get; set; } = DefaultVatRatePercent;

    /// <summary>
    /// A customer earns one point for every full amount of this many baht paid. 0 switches
    /// earning from sales off.
    /// </summary>
    public decimal BahtPerPoint { get; set; }

    /// <summary>
    /// What one point is worth, in baht, when a customer uses points as a discount on a bill.
    /// 0 switches paying with points off.
    /// </summary>
    public decimal PointValueBaht { get; set; }

    /// <summary>A line printed at the bottom of receipts.</summary>
    public string? ReceiptFooter { get; set; }
}
