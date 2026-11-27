using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Entities;

public class Customer : TenantEntity
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public int LoyaltyPoints { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Changes every time the row is saved (PostgreSQL's xmin). A save fails if the row changed
    /// since it was read, so two requests can never both act on the same old value.
    /// </summary>
    public uint RowVersion { get; set; }
    
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
