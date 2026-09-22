package com.freshfarm.inventory;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {

        return Map.of(
            "service", "Fresh Farm Inventory Service",
            "status", "UP"
        );
    }
}