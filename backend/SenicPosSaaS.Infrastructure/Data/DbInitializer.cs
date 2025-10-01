using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Check if database already has data
        if (context.Subscriptions.Any())
            return;

        var tenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

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
}
