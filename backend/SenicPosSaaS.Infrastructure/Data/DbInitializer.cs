using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Infrastructure.Data;

public static class DbInitializer
{
    /// <summary>The demo tenant every seeded row belongs to. Use it as the tenant id when signing in.</summary>
    public static readonly Guid DemoTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    /// <summary>
    /// Seeds demo data for local development. Demo users are only created when
    /// <paramref name="demoPassword"/> is configured (Seed:DemoPassword).
    /// </summary>
    public static async Task SeedAsync(ApplicationDbContext context, IPasswordHasher passwordHasher, string? demoPassword)
    {
        await SeedUsersAsync(context, passwordHasher, demoPassword);

        // Check if database already has data
        if (context.Subscriptions.Any())
            return;

        var tenantId = DemoTenantId;

        // Seed Subscription
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TenantName = "Demo Restaurant",
            Plan = SubscriptionPlan.Pro,
            Status = SubscriptionStatus.Active,
            StartDate = DateTime.UtcNow.AddMonths(-1),
            EndDate = DateTime.UtcNow.AddMonths(11),
            MonthlyFee = 599m,
            AutoRenew = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Subscriptions.Add(subscription);

        // Seed Customers
        var customers = new[]
        {
            new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                FirstName = "John",
                LastName = "Doe",
                Email = "john.doe@example.com",
                Phone = "+66-81-234-5678",
                LoyaltyPoints = 150,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                FirstName = "Jane",
                LastName = "Smith",
                Email = "jane.smith@example.com",
                Phone = "+66-81-987-6543",
                LoyaltyPoints = 220,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };
        context.Customers.AddRange(customers);

        // Seed Inventory Items
        var inventoryItems = new[]
        {
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = "FOOD-001",
                Name = "Pad Thai",
                Description = "Traditional Thai stir-fried noodles",
                Barcode = "8850999320014",
                Price = 120m,
                Cost = 50m,
                Quantity = 100,
                MinimumStock = 20,
                Category = "Main Course",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = "FOOD-002",
                Name = "Tom Yum Soup",
                Description = "Spicy and sour Thai soup",
                Barcode = "8850999320021",
                Price = 150m,
                Cost = 60m,
                Quantity = 80,
                MinimumStock = 15,
                Category = "Soup",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = "DRINK-001",
                Name = "Thai Iced Tea",
                Description = "Sweet and creamy Thai tea",
                Barcode = "8850999320038",
                Price = 45m,
                Cost = 15m,
                Quantity = 150,
                MinimumStock = 30,
                Category = "Beverage",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = "DESS-001",
                Name = "Mango Sticky Rice",
                Description = "Sweet sticky rice with fresh mango",
                Barcode = "8850999320045",
                Price = 80m,
                Cost = 30m,
                Quantity = 50,
                MinimumStock = 10,
                Category = "Dessert",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };
        context.InventoryItems.AddRange(inventoryItems);

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Creates the first Owner of the configured tenant, if that tenant has no users yet.
    /// Safe to run on every start: once the tenant has a user it does nothing, so leaving the
    /// settings in place can never reset a password or add a second account.
    /// Returns true when a user was created.
    /// </summary>
    public static async Task<bool> BootstrapOwnerAsync(ApplicationDbContext context, IPasswordHasher passwordHasher, BootstrapOptions options)
    {
        if (!options.IsConfigured)
            return false;

        if (options.TenantId is not { } tenantId || tenantId == Guid.Empty)
            throw new InvalidOperationException("Bootstrap:TenantId must be a GUID when Bootstrap:OwnerEmail is set.");
        if (options.OwnerPassword.Length < BootstrapOptions.MinimumPasswordLength)
            throw new InvalidOperationException($"Bootstrap:OwnerPassword must be at least {BootstrapOptions.MinimumPasswordLength} characters.");

        if (context.Users.Any(u => u.TenantId == tenantId))
            return false;

        context.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            // Sign-in looks emails up in lower case.
            Email = options.OwnerEmail.Trim().ToLower(),
            Name = string.IsNullOrWhiteSpace(options.OwnerName) ? "Owner" : options.OwnerName.Trim(),
            PasswordHash = passwordHasher.Hash(options.OwnerPassword),
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        return true;
    }

    /// <summary>One user per role: admin@, owner@, cashier@ and viewer@demo.test.</summary>
    private static async Task SeedUsersAsync(ApplicationDbContext context, IPasswordHasher passwordHasher, string? demoPassword)
    {
        if (string.IsNullOrEmpty(demoPassword) || context.Users.Any())
            return;

        foreach (var role in Enum.GetValues<UserRole>())
        {
            context.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                TenantId = DemoTenantId,
                Email = $"{role.ToString().ToLower()}@demo.test",
                Name = $"Demo {role}",
                PasswordHash = passwordHasher.Hash(demoPassword),
                Role = role,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync();
    }
}
