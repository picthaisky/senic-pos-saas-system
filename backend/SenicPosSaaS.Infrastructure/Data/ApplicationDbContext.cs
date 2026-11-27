using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    private readonly ICurrentUser? _currentUser;

    /// <param name="currentUser">
    /// When a user is signed in, every query on tenant-owned data is limited to their tenant.
    /// Without one (startup seeding, login, tests) no tenant filter is applied.
    /// </param>
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, ICurrentUser? currentUser = null)
        : base(options)
    {
        _currentUser = currentUser;
    }

    /// <summary>Read by the tenant query filters each time a query runs.</summary>
    private Guid? CurrentTenantId => _currentUser?.TenantId;

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTenant();
        var audit = AddAuditEntries();
        try
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            RemoveAuditEntries(audit);
            throw;
        }
    }

    public override int SaveChanges()
    {
        StampTenant();
        var audit = AddAuditEntries();
        try
        {
            return base.SaveChanges();
        }
        catch
        {
            RemoveAuditEntries(audit);
            throw;
        }
    }

    /// <summary>
    /// Records who is making the pending changes: on the rows themselves (CreatedBy, UpdatedBy)
    /// and, for the changes listed in <see cref="AuditTrail"/>, as audit entries saved in the
    /// same transaction. Nothing is recorded when nobody is signed in (seeding, sign-in,
    /// background jobs).
    /// </summary>
    private List<AuditLog> AddAuditEntries()
    {
        if (_currentUser?.UserId is not { } userId || CurrentTenantId is not { } tenantId)
            return [];

        var author = userId.ToString();
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedBy ??= author;
            else if (entry.State == EntityState.Modified) entry.Entity.UpdatedBy = author;
        }

        var audit = AuditTrail.Collect(ChangeTracker, userId, tenantId);
        AuditLogs.AddRange(audit);
        return audit;
    }

    /// <summary>After a failed save, so that a retry does not record the same change twice.</summary>
    private void RemoveAuditEntries(List<AuditLog> audit)
    {
        foreach (var log in audit)
            Entry(log).State = EntityState.Detached;
    }

    /// <summary>
    /// New tenant-owned rows get the signed-in user's tenant, and a row can never be written
    /// into a different tenant than the one the user belongs to.
    /// </summary>
    private void StampTenant()
    {
        var tenantId = CurrentTenantId;
        if (tenantId == null) return;

        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
                entry.Entity.TenantId = tenantId.Value;

            if (entry.State is EntityState.Added or EntityState.Modified && entry.Entity.TenantId != tenantId.Value)
                throw new InvalidOperationException("Attempted to write data that belongs to another tenant.");
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Tenant isolation for every entity derived from TenantEntity.
        modelBuilder.Entity<Order>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<InventoryItem>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Customer>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<User>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<LoyaltyTransaction>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<PushSubscription>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<AuditLog>().HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        // OrderItem has no TenantId of its own; it follows its order.
        modelBuilder.Entity<OrderItem>().HasQueryFilter(e => CurrentTenantId == null || e.Order!.TenantId == CurrentTenantId);

        // Configure Order entity
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.OrderNumber).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.ClientOrderId }).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.CreatedAt });
            entity.Property(e => e.OrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(e => e.TotalAmount).HasPrecision(18, 2);
            entity.Property(e => e.DiscountAmount).HasPrecision(18, 2);
            entity.Property(e => e.TaxAmount).HasPrecision(18, 2);
            entity.Property(e => e.NetAmount).HasPrecision(18, 2);

            entity.HasOne(e => e.Customer)
                .WithMany(c => c.Orders)
                .HasForeignKey(e => e.CustomerId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(e => e.OrderItems)
                .WithOne(oi => oi.Order)
                .HasForeignKey(oi => oi.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure OrderItem entity
        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UnitPrice).HasPrecision(18, 2);
            entity.Property(e => e.Discount).HasPrecision(18, 2);
            entity.Property(e => e.Subtotal).HasPrecision(18, 2);

            entity.HasOne(e => e.InventoryItem)
                .WithMany()
                .HasForeignKey(e => e.InventoryItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure InventoryItem entity
        modelBuilder.Entity<InventoryItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => new { e.TenantId, e.Sku }).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.Barcode }).IsUnique();
            entity.Property(e => e.Sku).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Barcode).HasMaxLength(50);
            entity.Property(e => e.Price).HasPrecision(18, 2);
            entity.Property(e => e.Cost).HasPrecision(18, 2);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.ImageUrl).HasMaxLength(500);
            // Guards the stock level against simultaneous sales.
            entity.Property(e => e.RowVersion).IsRowVersion();
        });

        // Configure Customer entity
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TenantId);
            // Email is optional; unique indexes ignore rows where it is null.
            entity.HasIndex(e => new { e.TenantId, e.Email }).IsUnique();
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.Address).HasMaxLength(500);
            // Guards the loyalty balance against simultaneous redemptions.
            entity.Property(e => e.RowVersion).IsRowVersion();
        });

        // Configure Subscription entity
        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TenantId).IsUnique();
            entity.Property(e => e.TenantName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.MonthlyFee).HasPrecision(18, 2);
            entity.Property(e => e.PaymentReference).HasMaxLength(100);
        });

        // Configure User entity
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.Email }).IsUnique();
            entity.Property(e => e.Email).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.PasswordHash).HasMaxLength(500).IsRequired();
        });

        // Configure RefreshToken entity
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.Property(e => e.TokenHash).HasMaxLength(64).IsRequired();

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        // A token is only reachable through its user, so it follows the user's tenant filter.
        modelBuilder.Entity<RefreshToken>().HasQueryFilter(e => CurrentTenantId == null || e.User!.TenantId == CurrentTenantId);

        // Configure PushSubscription entity
        modelBuilder.Entity<PushSubscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            // One row per browser, whoever is signed in on it.
            entity.HasIndex(e => e.Endpoint).IsUnique();
            entity.HasIndex(e => e.TenantId);
            entity.Property(e => e.Endpoint).HasMaxLength(1000).IsRequired();
            entity.Property(e => e.P256dh).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Auth).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Language).HasMaxLength(5).IsRequired();

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure AuditLog entity
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.CreatedAt });
            entity.HasIndex(e => new { e.TenantId, e.EntityType, e.EntityId });
            // Stored as text so the table can be read without knowing the enum's numbers.
            entity.Property(e => e.Action).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.EntityType).HasMaxLength(50).IsRequired();
            entity.Property(e => e.EntityLabel).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Changes).IsRequired();
            // No foreign key to the user or the record: the history must outlive both.
        });

        // Configure LoyaltyTransaction entity
        modelBuilder.Entity<LoyaltyTransaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.CustomerId });
            entity.Property(e => e.Description).HasMaxLength(500).IsRequired();

            entity.HasOne(e => e.Customer)
                .WithMany()
                .HasForeignKey(e => e.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
