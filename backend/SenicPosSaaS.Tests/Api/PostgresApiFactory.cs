using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Infrastructure.Data;
using Testcontainers.PostgreSql;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Hosts the API on a real PostgreSQL server, started in a throw-away Docker container and
/// created from the project's own migrations. Used for behaviour the in-memory database cannot
/// show: unique indexes, SQL translation, transactions and concurrent requests.
///
/// These tests need Docker. Without it, run the rest with:
///   dotnet test --filter "Category!=Postgres"
/// </summary>
public class PostgresApiFactory : ApiFactory, IAsyncLifetime
{
    /// <summary>Same major version as deploy/docker-compose.yml.</summary>
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .Build();

    protected override void ConfigureDatabase(DbContextOptionsBuilder options) =>
        options.UseNpgsql(_postgres.GetConnectionString());

    /// <summary>The schema comes from the migrations, exactly as in production.</summary>
    protected override Task PrepareDatabaseAsync(ApplicationDbContext db) => db.Database.MigrateAsync();

    public async Task InitializeAsync()
    {
        try
        {
            await _postgres.StartAsync();
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException(
                "Could not start the PostgreSQL test container. These tests need a running Docker daemon; " +
                "to run the others use: dotnet test --filter \"Category!=Postgres\"", exception);
        }
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}
