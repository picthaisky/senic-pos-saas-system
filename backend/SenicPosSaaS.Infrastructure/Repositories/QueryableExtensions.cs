using System.Linq.Expressions;

namespace SenicPosSaaS.Infrastructure.Repositories;

internal static class QueryableExtensions
{
    public static IOrderedQueryable<T> OrderByDirection<T, TKey>(this IQueryable<T> query, Expression<Func<T, TKey>> key, bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);
}
