using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Customer;

public class CustomerDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName => $"{FirstName} {LastName}".Trim();
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public int LoyaltyPoints { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LoyaltyTransactionDto
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public LoyaltyTransactionType Type { get; set; }
    public int Points { get; set; }
    public Guid? OrderId { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
