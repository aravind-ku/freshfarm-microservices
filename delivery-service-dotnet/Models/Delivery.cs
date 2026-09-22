namespace DeliveryService.Models;

public class Delivery
{
    public int Id { get; set; }

    public int OrderId { get; set; }

    public string CustomerName { get; set; } = "";

    public string Address { get; set; } = "";

    public string DeliveryPartner { get; set; } = "";

    public string Status { get; set; } = "ASSIGNED";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}