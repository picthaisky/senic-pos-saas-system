using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SenicPosSaaS.Application.DTOs.Customer;

public class CreateCustomerDto
{
    /// <summary>Set by the API from the signed-in user; never read from the request body.</summary>
    [JsonIgnore]
    public Guid TenantId { get; set; }

    [Required, StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [EmailAddress, StringLength(200)]
    public string? Email { get; set; }

    [StringLength(20)]
    public string? Phone { get; set; }

    [StringLength(500)]
    public string? Address { get; set; }

    public DateTime? DateOfBirth { get; set; }
}

/// <summary>Null properties are left unchanged.</summary>
public class UpdateCustomerDto
{
    [StringLength(100, MinimumLength = 1)]
    public string? FirstName { get; set; }

    [StringLength(100)]
    public string? LastName { get; set; }

    [EmailAddress, StringLength(200)]
    public string? Email { get; set; }

    [StringLength(20)]
    public string? Phone { get; set; }

    [StringLength(500)]
    public string? Address { get; set; }

    public DateTime? DateOfBirth { get; set; }
}

public class LoyaltyPointsRequestDto
{
    [Range(1, int.MaxValue)]
    public int Points { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}
