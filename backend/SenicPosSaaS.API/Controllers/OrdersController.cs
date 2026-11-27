using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.API.Controllers;

[Route("api/[controller]")]
public class OrdersController : TenantControllerBase
{
    private readonly IOrderService _orderService;
    private readonly TimeZoneInfo _businessTimeZone;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(IOrderService orderService, TimeZoneInfo businessTimeZone, ILogger<OrdersController> logger)
    {
        _orderService = orderService;
        _businessTimeZone = businessTimeZone;
        _logger = logger;
    }

    /// <summary>
    /// Orders of the tenant, newest first. <paramref name="from"/> and <paramref name="to"/> are
    /// calendar days (yyyy-MM-dd) in the shop's time zone, both inclusive.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = Roles.Reporting)]
    [ProducesResponseType(typeof(IEnumerable<OrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<OrderDto>>> GetOrders(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] OrderStatus? status,
        CancellationToken cancellationToken)
    {
        DateTime? fromUtc = from.HasValue
            ? TimeZoneInfo.ConvertTimeToUtc(from.Value.ToDateTime(TimeOnly.MinValue), _businessTimeZone)
            : null;
        DateTime? toUtc = to.HasValue
            ? TimeZoneInfo.ConvertTimeToUtc(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), _businessTimeZone)
            : null;

        var orders = await _orderService.SearchOrdersAsync(TenantId, fromUtc, toUtc, status, cancellationToken);
        return Ok(orders);
    }

    [HttpGet("{id:guid}")]
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
    /// Records a sale. Repeating a request with the same <c>clientOrderId</c> returns the order
    /// created the first time instead of creating another.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = Roles.Sellers)]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> CreateOrder([FromBody] CreateOrderDto dto, CancellationToken cancellationToken)
    {
        dto.TenantId = TenantId;
        var order = await _orderService.CreateOrderAsync(dto, cancellationToken);
        _logger.LogInformation("Order {OrderNumber} created successfully", order.OrderNumber);
        return CreatedAtAction(nameof(GetOrderById), new { id = order.Id }, order);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelOrder(Guid id, CancellationToken cancellationToken)
    {
        var result = await _orderService.CancelOrderAsync(id, cancellationToken);
        if (!result)
            return NotFound();

        _logger.LogInformation("Order {OrderId} cancelled successfully", id);
        return Ok(new { message = "Order cancelled successfully" });
    }
}
