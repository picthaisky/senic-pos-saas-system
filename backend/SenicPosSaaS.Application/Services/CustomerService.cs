using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class CustomerService : ICustomerService
{
    private readonly ICustomerRepository _repository;
    private readonly IRepository<LoyaltyTransaction> _loyalty;

    public CustomerService(ICustomerRepository repository, IRepository<LoyaltyTransaction> loyalty)
    {
        _repository = repository;
        _loyalty = loyalty;
    }

    public async Task<CustomerDto> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(dto.Email);
        await EnsureEmailIsFreeAsync(email, dto.TenantId, null, cancellationToken);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = dto.TenantId,
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            Email = email,
            Phone = NullIfBlank(dto.Phone),
            Address = NullIfBlank(dto.Address),
            DateOfBirth = dto.DateOfBirth,
            LoyaltyPoints = 0,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(customer, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(customer);
    }

    public async Task<CustomerDto?> GetCustomerByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var customer = await _repository.GetByIdAsync(id, cancellationToken);
        return customer != null ? MapToDto(customer) : null;
    }

    public async Task<IEnumerable<CustomerDto>> GetCustomersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var customers = await _repository.GetCustomersByTenantIdAsync(tenantId, cancellationToken);
        return customers.Select(MapToDto);
    }

    public async Task<IEnumerable<CustomerDto>> SearchCustomersAsync(Guid tenantId, string? search, CancellationToken cancellationToken = default)
    {
        var customers = await _repository.SearchAsync(tenantId, search, cancellationToken);
        return customers.Select(MapToDto);
    }

    public async Task<CustomerDto?> UpdateCustomerAsync(Guid id, UpdateCustomerDto dto, CancellationToken cancellationToken = default)
    {
        var customer = await _repository.GetByIdAsync(id, cancellationToken);
        if (customer == null) return null;

        if (dto.Email != null)
        {
            var email = NormalizeEmail(dto.Email);
            await EnsureEmailIsFreeAsync(email, customer.TenantId, customer.Id, cancellationToken);
            customer.Email = email;
        }
        if (dto.FirstName != null) customer.FirstName = dto.FirstName.Trim();
        if (dto.LastName != null) customer.LastName = dto.LastName.Trim();
        if (dto.Phone != null) customer.Phone = NullIfBlank(dto.Phone);
        if (dto.Address != null) customer.Address = NullIfBlank(dto.Address);
        if (dto.DateOfBirth.HasValue) customer.DateOfBirth = dto.DateOfBirth;
        customer.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(customer, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(customer);
    }

    public async Task<bool> DeleteCustomerAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var customer = await _repository.GetByIdAsync(id, cancellationToken);
        if (customer == null || !customer.IsActive) return false;

        // Soft delete: orders reference the customer, and the sales history must stay intact.
        customer.IsActive = false;
        customer.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(customer, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> AddLoyaltyPointsAsync(Guid customerId, int points, CancellationToken cancellationToken = default)
    {
        var customer = await _repository.GetByIdAsync(customerId, cancellationToken);
        if (customer == null) return false;

        customer.LoyaltyPoints += points;
        customer.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(customer, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    public Task<CustomerDto?> EarnPointsAsync(Guid customerId, int points, string description, CancellationToken cancellationToken = default) =>
        ChangePointsAsync(customerId, LoyaltyTransactionType.Earned, points, description, cancellationToken);

    public Task<CustomerDto?> RedeemPointsAsync(Guid customerId, int points, string description, CancellationToken cancellationToken = default) =>
        ChangePointsAsync(customerId, LoyaltyTransactionType.Redeemed, points, description, cancellationToken);

    public async Task<IEnumerable<LoyaltyTransactionDto>?> GetLoyaltyHistoryAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var customer = await _repository.GetByIdAsync(customerId, cancellationToken);
        if (customer == null) return null;

        var transactions = await _loyalty.FindAsync(t => t.CustomerId == customerId, cancellationToken);
        return transactions
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new LoyaltyTransactionDto
            {
                Id = t.Id,
                CustomerId = t.CustomerId,
                Type = t.Type,
                Points = t.Points,
                OrderId = t.OrderId,
                Description = t.Description,
                CreatedAt = t.CreatedAt
            });
    }

    private Task<CustomerDto?> ChangePointsAsync(Guid customerId, LoyaltyTransactionType type, int points, string description, CancellationToken cancellationToken)
    {
        if (points <= 0)
            throw new ArgumentOutOfRangeException(nameof(points), "Points must be greater than zero.");

        // Repeated from the fresh balance when another till changed it in the meantime, so two
        // redemptions can never both spend the same points.
        return ConcurrencyRetry.RunAsync(
            () => ChangePointsOnceAsync(customerId, type, points, description, cancellationToken),
            _repository.DiscardChanges,
            "The points could not be updated because the balance is changing. Please try again.");
    }

    private async Task<CustomerDto?> ChangePointsOnceAsync(Guid customerId, LoyaltyTransactionType type, int points, string description, CancellationToken cancellationToken)
    {
        var customer = await _repository.GetByIdAsync(customerId, cancellationToken);
        if (customer == null) return null;

        if (type == LoyaltyTransactionType.Redeemed && points > customer.LoyaltyPoints)
            throw new ConflictException($"Not enough points: the balance is {customer.LoyaltyPoints}.");

        customer.LoyaltyPoints += type == LoyaltyTransactionType.Earned ? points : -points;
        customer.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(customer, cancellationToken);

        await _loyalty.AddAsync(new LoyaltyTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = customer.TenantId,
            CustomerId = customer.Id,
            Type = type,
            Points = points,
            Description = description,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        // Both changes go through the same DbContext, so this one save is atomic.
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(customer);
    }

    private async Task EnsureEmailIsFreeAsync(string? email, Guid tenantId, Guid? exceptCustomerId, CancellationToken cancellationToken)
    {
        if (email == null) return;

        var existing = await _repository.GetByEmailAsync(email, tenantId, cancellationToken);
        if (existing != null && existing.Id != exceptCustomerId)
            throw new ConflictException($"A customer with email {email} already exists.");
    }

    private static string? NormalizeEmail(string? email) => NullIfBlank(email)?.ToLower();

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static CustomerDto MapToDto(Customer customer)
    {
        return new CustomerDto
        {
            Id = customer.Id,
            FirstName = customer.FirstName,
            LastName = customer.LastName,
            Email = customer.Email,
            Phone = customer.Phone,
            Address = customer.Address,
            LoyaltyPoints = customer.LoyaltyPoints,
            DateOfBirth = customer.DateOfBirth,
            IsActive = customer.IsActive,
            CreatedAt = customer.CreatedAt
        };
    }
}
