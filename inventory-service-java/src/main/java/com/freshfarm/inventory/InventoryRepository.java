package com.freshfarm.inventory;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InventoryRepository
        extends JpaRepository<Inventory, Integer> {

    Optional<Inventory> findByProductTypeAndProductId(
        String productType,
        Integer productId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT i
        FROM Inventory i
        WHERE i.productType = :productType
          AND i.productId = :productId
    """)
    Optional<Inventory> findForUpdate(
        @Param("productType") String productType,
        @Param("productId") Integer productId
    );
}