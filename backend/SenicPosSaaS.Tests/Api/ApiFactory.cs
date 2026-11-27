using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Hosts the real API (routing, authentication, authorization, JSON settings, error handling)
/// on an in-memory database. Each instance has its own database with two tenants so tests can
/// check that one tenant never sees the other's data.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public static readonly Guid TenantA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public static readonly Guid TenantB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    public const string Password = "Test-Pass-1234";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly string _databaseName = $"api-tests-{Guid.NewGuid()}";
    private readonly object _seedLock = new();
    private Task? _seeding;

    /// <summary>Stands in for the Web Push sender: records what would have been sent.</summary>
    public FakePushSender Push { get; } = new();

    public ApiFactory()
    {
        // The refresh cookie is Secure outside Development, so the test client must use https.
        ClientOptions.BaseAddress = new Uri("https://localhost");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Jwt:Key", "integration-test-signing-key-0123456789abcdef");
        builder.UseSetting("LoginProtection:RequestsPerMinutePerIp", "100000");
        ConfigureSettings(builder);

        builder.ConfigureServices(services =>
        {
            // Replace the configured database with the one this factory tests against.
            var registered = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>) ||
                            d.ServiceType == typeof(IDbContextOptionsConfiguration<ApplicationDbContext>))
                .ToList();
            foreach (var descriptor in registered)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(ConfigureDatabase);

            // Record push notifications instead of calling real push services.
            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IPushSender)).ToList())
                services.Remove(descriptor);
            services.AddSingleton<IPushSender>(Push);
        });
    }

    /// <summary>Extra configuration for a specialised factory.</summary>
    protected virtual void ConfigureSettings(IWebHostBuilder builder)
    {
    }

    /// <summary>
    /// Which database the API under test uses. In-memory by default: fast, but it enforces no
    /// unique indexes and has no real concurrency, so <see cref="PostgresApiFactory"/> overrides it.
    /// </summary>
    protected virtual void ConfigureDatabase(DbContextOptionsBuilder options) =>
        options.UseInMemoryDatabase(_databaseName);

    /// <summary>Runs once before the test users are created, e.g. to apply migrations.</summary>
    protected virtual Task PrepareDatabaseAsync(ApplicationDbContext db) => Task.CompletedTask;

    /// <summary>Runs <paramref name="action"/> against the database with no tenant filter (no signed-in user).</summary>
    public async Task WithDbAsync(Func<ApplicationDbContext, Task> action)
    {
        await EnsureSeededAsync();
        using var scope = Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    /// <summary>Prepares the database and creates the test users, once per factory.</summary>
    private Task EnsureSeededAsync()
    {
        lock (_seedLock)
            return _seeding ??= SeedAsync();
    }

    private async Task SeedAsync()
    {
        using var scope = Services.CreateScope();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await PrepareDatabaseAsync(db);
        var hash = hasher.Hash(Password);

        void AddUser(Guid tenantId, string email, UserRole role) => db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email,
            Name = email.Split('@')[0],
            PasswordHash = hash,
            Role = role,
            CreatedAt = DateTime.UtcNow
        });

        AddUser(TenantA, "owner@a.test", UserRole.Owner);
        AddUser(TenantA, "cashier@a.test", UserRole.Cashier);
        AddUser(TenantA, "viewer@a.test", UserRole.Viewer);
        AddUser(TenantB, "owner@b.test", UserRole.Owner);
        await db.SaveChangesAsync();
    }

    public async Task<InventoryItem> AddItemAsync(Guid tenantId, string name, decimal price, int quantity, int minimumStock = 0, string? barcode = null, string? category = null, bool isActive = true)
    {
        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Sku = $"SKU-{Guid.NewGuid():N}"[..12],
            Name = name,
            Barcode = barcode,
            Category = category,
            Price = price,
            Cost = price / 2,
            Quantity = quantity,
            MinimumStock = minimumStock,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow
        };
        await WithDbAsync(async db =>
        {
            db.InventoryItems.Add(item);
            await db.SaveChangesAsync();
        });
        return item;
    }

    public async Task<int> StockOfAsync(Guid itemId)
    {
        var quantity = 0;
        await WithDbAsync(async db => quantity = (await db.InventoryItems.SingleAsync(i => i.Id == itemId)).Quantity);
        return quantity;
    }

    /// <summary>A client that is not signed in. It keeps cookies, like a browser.</summary>
    public async Task<HttpClient> AnonymousAsync()
    {
        var client = CreateClient();
        await EnsureSeededAsync();
        return client;
    }

    /// <summary>A client signed in as <paramref name="email"/>, sending its access token on every request.</summary>
    public async Task<HttpClient> SignInAsync(string email, Guid? tenantId = null)
    {
        var client = await AnonymousAsync();
        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            tenantId = tenantId ?? (email.EndsWith("@b.test") ? TenantB : TenantA),
            email,
            password = Password
        });
        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<AuthResponseDto>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }
}
