using System.ComponentModel.DataAnnotations;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Shop;

/// <summary>GET and PUT /api/shop-settings. PUT replaces every field.</summary>
public class ShopSettingsDto
{
    [StringLength(200)]
    public string ShopName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Address { get; set; }

    [StringLength(20)]
    public string? Phone { get; set; }

    /// <summary>13 digits, or empty.</summary>
    [RegularExpression(@"^(\d{13})?$", ErrorMessage = "The tax ID must be 13 digits.")]
    public string? TaxId { get; set; }

    [StringLength(100)]
    public string? Branch { get; set; }

    [EnumDataType(typeof(VatMode))]
    public VatMode VatMode { get; set; }

    [Range(0, 100)]
    public decimal VatRatePercent { get; set; }

    /// <summary>One point per this many baht paid; 0 = sales earn no points.</summary>
    [Range(0, 1_000_000)]
    public decimal BahtPerPoint { get; set; }

    [StringLength(500)]
    public string? ReceiptFooter { get; set; }
}
