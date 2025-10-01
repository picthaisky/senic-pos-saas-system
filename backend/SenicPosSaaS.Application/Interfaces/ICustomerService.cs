using SenicPosSaaS.Application.DTOs.Customer;

namespace SenicPosSaaS.Application.Interfaces;

public interface ICustomerService
{
    Task<CustomerDto> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken cancellationToken = default);
    Task<CustomerDto?> GetCustomerByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<CustomerDto>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool> AddLoyaltyPointsAsync(Guid customerId, int points, CancellationToken cancellationToken = default);
}
