using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Infrastructure.Repositories;

public class CustomerRepository : Repository<Customer>, ICustomerRepository
{
    public CustomerRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Customer>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await SearchAsync(tenantId, null, cancellationToken);
    }

    public async Task<IEnumerable<Customer>> SearchAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default)
    {
        var query = _dbSet.Where(c => c.TenantId == tenantId && c.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.FirstName.ToLower().Contains(term) ||
                c.LastName.ToLower().Contains(term) ||
                (c.Email != null && c.Email.ToLower().Contains(term)) ||
                (c.Phone != null && c.Phone.Contains(term)));
        }

        return await query
            .OrderBy(c => c.FirstName)
            .ThenBy(c => c.LastName)
            .ToListAsync(cancellationToken);
    }

    public async Task<Customer?> GetByEmailAsync(string email, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .FirstOrDefaultAsync(c => c.Email == email && c.TenantId == tenantId, cancellationToken);
    }
}
