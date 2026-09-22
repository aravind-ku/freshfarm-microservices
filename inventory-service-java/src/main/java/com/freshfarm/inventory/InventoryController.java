package com.freshfarm.inventory;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/inventory")
@CrossOrigin(origins = "*")
public class InventoryController {

    private final InventoryService service;

    public InventoryController(
        InventoryService service
    ) {
        this.service = service;
    }

    @GetMapping
    public List<Inventory> getAllInventory() {
        return service.getAllInventory();
    }

    @GetMapping("/{productType}/{productId}")
    public Inventory getInventory(
        @PathVariable String productType,
        @PathVariable Integer productId
    ) {
        return service.getInventory(
            productType,
            productId
        );
    }

    @PostMapping
    public Inventory createInventory(
        @RequestBody Inventory inventory
    ) {
        return service.createInventory(inventory);
    }

    @PatchMapping("/{productType}/{productId}/reduce")
    public Inventory reduceStock(
        @PathVariable String productType,
        @PathVariable Integer productId,
        @RequestBody Map<String, Integer> request
    ) {
        return service.reduceStock(
            productType,
            productId,
            request.get("quantity")
        );
    }

    @PatchMapping("/{productType}/{productId}/increase")
    public Inventory increaseStock(
        @PathVariable String productType,
        @PathVariable Integer productId,
        @RequestBody Map<String, Integer> request
    ) {
        return service.increaseStock(
            productType,
            productId,
            request.get("quantity")
        );
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>>
    handleRuntimeException(RuntimeException ex) {

        return ResponseEntity
            .badRequest()
            .body(
                Map.of(
                    "message",
                    ex.getMessage()
                )
            );
    }
}