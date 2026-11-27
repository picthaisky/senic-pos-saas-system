using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SenicPosSaaS.Infrastructure.Data;

/// <summary>
/// Used only by the `dotnet ef` tools to build the model when adding migrations, e.g.
/// <c>dotnet ef migrations add Name --project SenicPosSaaS.Infrastructure</c>.
/// It never opens a connection for that, so the connection string is a placeholder.
/// Migrations target PostgreSQL, the default provider.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=SenicPosDb")
            .Options;
        return new ApplicationDbContext(options);
    }
}
