using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Common;
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
        return await Filter(tenantId, search)
            .OrderBy(c => c.FirstName)
            .ThenBy(c => c.LastName)
            .ToListAsync(cancellationToken);
    }

    public async Task<PagedList<Customer>> SearchPageAsync(Guid tenantId, string? search, SortSpec? sort, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = Filter(tenantId, search);
        var total = await query.CountAsync(cancellationToken);

        var by = sort ?? new SortSpec("name", false);
        var ordered = by.Field switch
        {
            "loyaltyPoints" => query.OrderByDirection(c => c.LoyaltyPoints, by.Descending),
            "createdAt" => query.OrderByDirection(c => c.CreatedAt, by.Descending),
            _ => by.Descending
                ? query.OrderByDescending(c => c.FirstName).ThenByDescending(c => c.LastName)
                : query.OrderBy(c => c.FirstName).ThenBy(c => c.LastName),
        };
        var items = await ordered.ThenBy(c => c.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);
        return new PagedList<Customer>(items, total);
    }

    private IQueryable<Customer> Filter(Guid tenantId, string? search)
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

        return query;
    }

    public async Task<Customer?> GetByEmailAsync(string email, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .FirstOrDefaultAsync(c => c.Email == email && c.TenantId == tenantId, cancellationToken);
    }
}
