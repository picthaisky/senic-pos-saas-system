using System.Linq.Expressions;
using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<T>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task<T> AddAsync(T entity, CancellationToken cancellationToken = default);
    Task UpdateAsync(T entity, CancellationToken cancellationToken = default);
    Task DeleteAsync(T entity, CancellationToken cancellationToken = default);

    /// <summary>
    /// Saves all pending changes in one transaction. Throws <see cref="ConcurrencyException"/> when
    /// a row was changed by someone else in the meantime, and <see cref="DuplicateKeyException"/>
    /// when a unique value already exists; in both cases nothing was saved.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Forgets everything read or changed so far in this unit of work (across all repositories
    /// of the request), so the operation can be attempted again from fresh data.
    /// </summary>
    void DiscardChanges();
}
