using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(IOrderService orderService, ILogger<OrdersController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new order
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrderDto>> CreateOrder([FromBody] CreateOrderDto dto, CancellationToken cancellationToken)
    {
        try
        {
            var order = await _orderService.CreateOrderAsync(dto, cancellationToken);
            _logger.LogInformation("Order {OrderNumber} created successfully", order.OrderNumber);
            return CreatedAtAction(nameof(GetOrderById), new { id = order.Id }, order);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to create order");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get order by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDto>> GetOrderById(Guid id, CancellationToken cancellationToken)
    {
        var order = await _orderService.GetOrderByIdAsync(id, cancellationToken);
        if (order == null)
            return NotFound();

        return Ok(order);
    }

    /// <summary>
    /// Get all orders for a tenant
    /// </summary>
    [HttpGet("tenant/{tenantId}")]
    [ProducesResponseType(typeof(IEnumerable<OrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<OrderDto>>> GetOrdersByTenantId(Guid tenantId, CancellationToken cancellationToken)
    {
        var orders = await _orderService.GetOrdersByTenantIdAsync(tenantId, cancellationToken);
        return Ok(orders);
    }

    /// <summary>
    /// Cancel an order
    /// </summary>
    [HttpPost("{id}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelOrder(Guid id, CancellationToken cancellationToken)
    {
        var result = await _orderService.CancelOrderAsync(id, cancellationToken);
        if (!result)
            return NotFound();

        _logger.LogInformation("Order {OrderId} cancelled", id);
        return Ok(new { message = "Order cancelled successfully" });
    }
}
