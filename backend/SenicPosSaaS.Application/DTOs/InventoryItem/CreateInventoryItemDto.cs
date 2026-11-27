using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SenicPosSaaS.Application.DTOs.InventoryItem;

public class CreateInventoryItemDto
{
    /// <summary>Set by the API from the signed-in user; never read from the request body.</summary>
    [JsonIgnore]
    public Guid TenantId { get; set; }

    [Required, StringLength(50)]
    public string Sku { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [StringLength(50)]
    public string? Barcode { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Cost { get; set; }

    [Range(0, int.MaxValue)]
    public int Quantity { get; set; }

    [Range(0, int.MaxValue)]
    public int MinimumStock { get; set; }

    [StringLength(100)]
    public string? Category { get; set; }

    [StringLength(500)]
    public string? ImageUrl { get; set; }
}
