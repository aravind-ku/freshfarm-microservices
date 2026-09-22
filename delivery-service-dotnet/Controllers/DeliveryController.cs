using Microsoft.AspNetCore.Mvc;
using DeliveryService.Models;

namespace DeliveryService.Controllers;

[ApiController]
[Route("")]
public class DeliveryController : ControllerBase
{
    private static readonly List<Delivery> Deliveries = new();

    private static int _nextId = 1;

    // ==========================================
    // HEALTH
    // ==========================================

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            service = "Fresh Farm Delivery Service",
            language = ".NET",
            status = "UP"
        });
    }

    // ==========================================
    // GET ALL DELIVERIES
    // ==========================================

    [HttpGet("deliveries")]
    public IActionResult GetDeliveries()
    {
        return Ok(Deliveries);
    }

    // ==========================================
    // GET DELIVERY BY ID
    // ==========================================

    [HttpGet("deliveries/{id:int}")]
    public IActionResult GetDelivery(int id)
    {
        var delivery = Deliveries.FirstOrDefault(d => d.Id == id);

        if (delivery == null)
        {
            return NotFound(new
            {
                message = "Delivery not found"
            });
        }

        return Ok(delivery);
    }

    // ==========================================
    // GET DELIVERY BY ORDER ID
    // ==========================================

    [HttpGet("deliveries/order/{orderId:int}")]
    public IActionResult GetDeliveryByOrder(int orderId)
    {
        var delivery =
            Deliveries.FirstOrDefault(d => d.OrderId == orderId);

        if (delivery == null)
        {
            return NotFound(new
            {
                message = "Delivery not found for this order"
            });
        }

        return Ok(delivery);
    }

    // ==========================================
    // CREATE DELIVERY
    // ==========================================

    [HttpPost("deliveries")]
    public IActionResult CreateDelivery(
        [FromBody] CreateDeliveryRequest request)
    {
        if (request.OrderId <= 0)
        {
            return BadRequest(new
            {
                message = "Valid order ID is required"
            });
        }

        if (string.IsNullOrWhiteSpace(request.CustomerName) ||
            string.IsNullOrWhiteSpace(request.Address))
        {
            return BadRequest(new
            {
                message = "Customer name and address are required"
            });
        }

        if (Deliveries.Any(d => d.OrderId == request.OrderId))
        {
            return Conflict(new
            {
                message = "Delivery already exists for this order"
            });
        }

        var delivery = new Delivery
        {
            Id = _nextId++,
            OrderId = request.OrderId,
            CustomerName = request.CustomerName,
            Address = request.Address,
            DeliveryPartner =
                string.IsNullOrWhiteSpace(request.DeliveryPartner)
                    ? "Fresh Farm Delivery Partner"
                    : request.DeliveryPartner,

            Status = "ASSIGNED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        Deliveries.Add(delivery);

        Console.WriteLine(
            $"Delivery created: Order #{delivery.OrderId} " +
            $"→ {delivery.DeliveryPartner}"
        );

        return Created(
            $"/deliveries/{delivery.Id}",
            delivery
        );
    }

    // ==========================================
    // UPDATE DELIVERY STATUS
    // ==========================================

    [HttpPatch("deliveries/{id:int}/status")]
    public IActionResult UpdateStatus(
        int id,
        [FromBody] UpdateDeliveryStatusRequest request)
    {
        var delivery = Deliveries.FirstOrDefault(d => d.Id == id);

        if (delivery == null)
        {
            return NotFound(new
            {
                message = "Delivery not found"
            });
        }

        var status = request.Status?.Trim().ToUpperInvariant();

        string[] allowedStatuses =
        {
            "ASSIGNED",
            "PICKED_UP",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "FAILED"
        };

        if (string.IsNullOrWhiteSpace(status) ||
            !allowedStatuses.Contains(status))
        {
            return BadRequest(new
            {
                message = "Invalid delivery status",
                allowedStatuses
            });
        }

        delivery.Status = status;
        delivery.UpdatedAt = DateTime.UtcNow;

        Console.WriteLine(
            $"Delivery #{delivery.Id} → {delivery.Status}"
        );

        return Ok(delivery);
    }
}


public class CreateDeliveryRequest
{
    public int OrderId { get; set; }

    public string CustomerName { get; set; } = "";

    public string Address { get; set; } = "";

    public string DeliveryPartner { get; set; } = "";
}


public class UpdateDeliveryStatusRequest
{
    public string Status { get; set; } = "";
}