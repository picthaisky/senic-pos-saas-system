using SenicPosSaaS.Application.DTOs.Customer;

namespace SenicPosSaaS.Application.Interfaces;

public interface ICustomerService
{
    Task<CustomerDto> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken cancellationToken = default);
    Task<CustomerDto?> GetCustomerByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<CustomerDto>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<CustomerDto>> SearchCustomersAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default);
    Task<CustomerDto?> UpdateCustomerAsync(Guid id, UpdateCustomerDto dto, CancellationToken cancellationToken = default);

    /// <summary>Deactivates the customer; their orders and points history are kept.</summary>
    Task<bool> DeleteCustomerAsync(Guid id, CancellationToken cancellationToken = default);

    Task<bool> AddLoyaltyPointsAsync(Guid customerId, int points, CancellationToken cancellationToken = default);

    /// <summary>Adds points and records why. Null when the customer does not exist.</summary>
    Task<CustomerDto?> EarnPointsAsync(Guid customerId, int points, string description, CancellationToken cancellationToken = default);

    /// <summary>
    /// Spends points and records why. Null when the customer does not exist.
    /// Throws <see cref="Common.ConflictException"/> when the balance is too low.
    /// </summary>
    Task<CustomerDto?> RedeemPointsAsync(Guid customerId, int points, string description, CancellationToken cancellationToken = default);

    /// <summary>Newest first. Null when the customer does not exist.</summary>
    Task<IEnumerable<LoyaltyTransactionDto>?> GetLoyaltyHistoryAsync(Guid customerId, CancellationToken cancellationToken = default);
}
