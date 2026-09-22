package com.freshfarm.inventory;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class InventoryService {

    private final InventoryRepository repository;

    public InventoryService(InventoryRepository repository) {
        this.repository = repository;
    }

    public List<Inventory> getAllInventory() {
        return repository.findAll();
    }

    public Inventory getInventory(
        String productType,
        Integer productId
    ) {
        return repository
            .findByProductTypeAndProductId(
                productType.toUpperCase(),
                productId
            )
            .orElseThrow(
                () -> new RuntimeException(
                    "Inventory item not found"
                )
            );
    }

    public Inventory createInventory(Inventory inventory) {

        inventory.setProductType(
            inventory.getProductType().toUpperCase()
        );

        updateStatus(inventory);

        return repository.save(inventory);
    }

    @Transactional
    public Inventory reduceStock(
        String productType,
        Integer productId,
        Integer quantity
    ) {

        if (quantity == null || quantity <= 0) {
            throw new RuntimeException(
                "Quantity must be greater than zero"
            );
        }

        Inventory inventory = repository
            .findForUpdate(
                productType.toUpperCase(),
                productId
            )
            .orElseThrow(
                () -> new RuntimeException(
                    "Inventory item not found"
                )
            );

        if (inventory.getQuantityAvailable() < quantity) {
            throw new RuntimeException(
                "Insufficient stock"
            );
        }

        inventory.setQuantityAvailable(
            inventory.getQuantityAvailable() - quantity
        );

        updateStatus(inventory);

        return repository.save(inventory);
    }

    @Transactional
    public Inventory increaseStock(
        String productType,
        Integer productId,
        Integer quantity
    ) {

        if (quantity == null || quantity <= 0) {
            throw new RuntimeException(
                "Quantity must be greater than zero"
            );
        }

        Inventory inventory = repository
            .findForUpdate(
                productType.toUpperCase(),
                productId
            )
            .orElseThrow(
                () -> new RuntimeException(
                    "Inventory item not found"
                )
            );

        inventory.setQuantityAvailable(
            inventory.getQuantityAvailable() + quantity
        );

        updateStatus(inventory);

        return repository.save(inventory);
    }

    private void updateStatus(Inventory inventory) {

        if (inventory.getQuantityAvailable() <= 0) {
            inventory.setStatus("OUT_OF_STOCK");
        } else if (
            inventory.getQuantityAvailable()
                <= inventory.getReorderLevel()
        ) {
            inventory.setStatus("LOW_STOCK");
        } else {
            inventory.setStatus("IN_STOCK");
        }
    }
}