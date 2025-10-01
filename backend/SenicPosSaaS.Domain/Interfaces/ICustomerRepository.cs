using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface ICustomerRepository : IRepository<Customer>
{
    Task<IEnumerable<Customer>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<Customer?> GetByEmailAsync(string email, Guid tenantId, CancellationToken cancellationToken = default);
}
