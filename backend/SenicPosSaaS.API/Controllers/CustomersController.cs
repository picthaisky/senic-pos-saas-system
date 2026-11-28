using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.DTOs;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.API.Controllers;

[Route("api/[controller]")]
public class CustomersController : TenantControllerBase
{
    private readonly ICustomerService _customerService;
    private readonly ILogger<CustomersController> _logger;

    public CustomersController(ICustomerService customerService, ILogger<CustomersController> logger)
    {
        _customerService = customerService;
        _logger = logger;
    }

    /// <summary>
    /// Active customers of the tenant. With <paramref name="page"/> the answer is one page
    /// (<see cref="PageDto{T}"/>); without it, the whole list as an array, which is kept for
    /// clients written before paging and will be removed.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PageDto<CustomerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetCustomers(
        [FromQuery] string? search,
        [FromQuery] int? page = null,
        [FromQuery] int pageSize = PageRequest.DefaultPageSize,
        [FromQuery] string? sort = null,
        CancellationToken cancellationToken = default)
    {
        if (page == null)
            return Ok(await _customerService.SearchCustomersAsync(TenantId, search, cancellationToken));

        if (!SortSpec.TryParse(sort, SortFields.Customers, out var order))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["sort"] = [$"Unknown sort field. Use one of: {string.Join(", ", SortFields.Customers)}; prefix with '-' for descending."]
            }));

        return Ok(await _customerService.SearchCustomersPageAsync(TenantId, search, order, page.Value, pageSize, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CustomerDto>> GetCustomerById(Guid id, CancellationToken cancellationToken)
    {
        var customer = await _customerService.GetCustomerByIdAsync(id, cancellationToken);
        if (customer == null)
            return NotFound();

        return Ok(customer);
    }

    [HttpPost]
    [Authorize(Roles = Roles.Sellers)]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CustomerDto>> CreateCustomer([FromBody] CreateCustomerDto dto, CancellationToken cancellationToken)
    {
        dto.TenantId = TenantId;
        var customer = await _customerService.CreateCustomerAsync(dto, cancellationToken);
        _logger.LogInformation("Customer {CustomerId} created successfully", customer.Id);
        return CreatedAtAction(nameof(GetCustomerById), new { id = customer.Id }, customer);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CustomerDto>> UpdateCustomer(Guid id, [FromBody] UpdateCustomerDto dto, CancellationToken cancellationToken)
    {
        var customer = await _customerService.UpdateCustomerAsync(id, dto, cancellationToken);
        if (customer == null)
            return NotFound();

        return Ok(customer);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCustomer(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await _customerService.DeleteCustomerAsync(id, cancellationToken);
        if (!deleted)
            return NotFound();

        _logger.LogInformation("Customer {CustomerId} deleted", id);
        return NoContent();
    }

    [HttpGet("{id:guid}/loyalty")]
    [ProducesResponseType(typeof(IEnumerable<LoyaltyTransactionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<LoyaltyTransactionDto>>> GetLoyaltyHistory(Guid id, CancellationToken cancellationToken)
    {
        var history = await _customerService.GetLoyaltyHistoryAsync(id, cancellationToken);
        if (history == null)
            return NotFound();

        return Ok(history);
    }

    [HttpPost("{id:guid}/loyalty/earn")]
    [Authorize(Roles = Roles.Sellers)]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CustomerDto>> EarnPoints(Guid id, [FromBody] LoyaltyPointsRequestDto request, CancellationToken cancellationToken)
    {
        var customer = await _customerService.EarnPointsAsync(id, request.Points, request.Description?.Trim() ?? string.Empty, cancellationToken);
        if (customer == null)
            return NotFound();

        _logger.LogInformation("Added {Points} loyalty points to customer {CustomerId}", request.Points, id);
        return Ok(customer);
    }

    [HttpPost("{id:guid}/loyalty/redeem")]
    [Authorize(Roles = Roles.Sellers)]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CustomerDto>> RedeemPoints(Guid id, [FromBody] LoyaltyPointsRequestDto request, CancellationToken cancellationToken)
    {
        var customer = await _customerService.RedeemPointsAsync(id, request.Points, request.Description?.Trim() ?? string.Empty, cancellationToken);
        if (customer == null)
            return NotFound();

        _logger.LogInformation("Redeemed {Points} loyalty points from customer {CustomerId}", request.Points, id);
        return Ok(customer);
    }
}
