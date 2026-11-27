using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface ICustomerRepository : IRepository<Customer>
{
    Task<IEnumerable<Customer>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Active customers whose name, email or phone contains <paramref name="search"/> (all when null).</summary>
    Task<IEnumerable<Customer>> SearchAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default);

    Task<Customer?> GetByEmailAsync(string email, Guid tenantId, CancellationToken cancellationToken = default);
}
