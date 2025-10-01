using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Entities;

public class Customer : TenantEntity
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public int LoyaltyPoints { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public bool IsActive { get; set; } = true;
    
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
