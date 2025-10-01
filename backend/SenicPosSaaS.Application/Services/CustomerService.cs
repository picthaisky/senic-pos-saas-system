using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class CustomerService : ICustomerService
{
    private readonly ICustomerRepository _repository;

    public CustomerService(ICustomerRepository repository)
    {
        _repository = repository;
    }

    public async Task<CustomerDto> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken cancellationToken = default)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = dto.TenantId,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Email = dto.Email,
            Phone = dto.Phone,
            Address = dto.Address,
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
