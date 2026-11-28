using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface ICustomerRepository : IRepository<Customer>
{
    Task<IEnumerable<Customer>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Active customers whose name, email or phone contains <paramref name="search"/> (all when null).</summary>
    Task<IEnumerable<Customer>> SearchAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default);

    /// <summary>
    /// One page of the same search. <paramref name="sort"/> is a field of
    /// <see cref="SortFields.Customers"/>; null sorts by name.
    /// </summary>
    Task<PagedList<Customer>> SearchPageAsync(Guid tenantId, string? search, SortSpec? sort, int skip, int take, CancellationToken cancellationToken = default);

    Task<Customer?> GetByEmailAsync(string email, Guid tenantId, CancellationToken cancellationToken = default);
}
