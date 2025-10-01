using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _customerService;
    private readonly ILogger<CustomersController> _logger;

    public CustomersController(ICustomerService customerService, ILogger<CustomersController> logger)
    {
        _customerService = customerService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new customer
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CustomerDto>> CreateCustomer([FromBody] CreateCustomerDto dto, CancellationToken cancellationToken)
    {
        var customer = await _customerService.CreateCustomerAsync(dto, cancellationToken);
        _logger.LogInformation("Customer {CustomerName} created successfully", customer.FullName);
        return CreatedAtAction(nameof(GetCustomerById), new { id = customer.Id }, customer);
    }

    /// <summary>
    /// Get customer by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CustomerDto>> GetCustomerById(Guid id, CancellationToken cancellationToken)
    {
        var customer = await _customerService.GetCustomerByIdAsync(id, cancellationToken);
        if (customer == null)
            return NotFound();

        return Ok(customer);
    }

    /// <summary>
    /// Get all customers for a tenant
    /// </summary>
    [HttpGet("tenant/{tenantId}")]
    [ProducesResponseType(typeof(IEnumerable<CustomerDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<CustomerDto>>> GetCustomersByTenantId(Guid tenantId, CancellationToken cancellationToken)
    {
        var customers = await _customerService.GetCustomersByTenantIdAsync(tenantId, cancellationToken);
        return Ok(customers);
    }

    /// <summary>
    /// Add loyalty points to a customer
    /// </summary>
    [HttpPost("{id}/loyalty-points")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddLoyaltyPoints(Guid id, [FromBody] AddLoyaltyPointsRequest request, CancellationToken cancellationToken)
    {
        var result = await _customerService.AddLoyaltyPointsAsync(id, request.Points, cancellationToken);
        if (!result)
            return NotFound();

        _logger.LogInformation("Added {Points} loyalty points to customer {CustomerId}", request.Points, id);
        return Ok(new { message = "Loyalty points added successfully" });
    }
}

public record AddLoyaltyPointsRequest(int Points);
