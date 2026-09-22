package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Price       float64 `json:"price"`
	Unit        string  `json:"unit"`
	Description string  `json:"description"`
	Available   bool    `json:"available"`
}

var (
	products = []Product{
		{1, "Fresh Paneer", "Dairy", 120, "500g", "Fresh farm paneer", true},
		{2, "Fresh Curd", "Dairy", 60, "500g", "Naturally prepared curd", true},
		{3, "Pure Ghee", "Dairy", 650, "1L", "Pure cow milk ghee", true},
		{4, "Fresh Butter", "Dairy", 110, "500g", "Fresh dairy butter", true},
		{5, "Milk Peda", "Sweets", 180, "500g", "Traditional milk peda", true},
		{6, "Kalakand", "Sweets", 220, "500g", "Fresh milk kalakand", true},
		{7, "Rasgulla", "Sweets", 160, "500g", "Soft milk rasgulla", true},
		{8, "Gulab Jamun", "Sweets", 170, "500g", "Traditional gulab jamun", true},
		{9, "Milk Cake", "Sweets", 240, "500g", "Fresh milk cake", true},
		{10, "Khoa", "Dairy", 190, "500g", "Fresh milk khoa", true},
	}

	mutex  sync.Mutex
	nextID = 11
)

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	json.NewEncoder(w).Encode(map[string]string{
		"status":  "UP",
		"service": "Fresh Farm Dairy Products Service",
	})
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch r.Method {

	case http.MethodGet:
		json.NewEncoder(w).Encode(products)

	case http.MethodPost:
		var product Product

		if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
			http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
			return
		}

		mutex.Lock()
		product.ID = nextID
		nextID++
		products = append(products, product)
		mutex.Unlock()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(product)

	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func productByIDHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	idText := strings.TrimPrefix(r.URL.Path, "/products/")
	id, err := strconv.Atoi(idText)

	if err != nil {
		http.Error(w, `{"error":"Invalid product ID"}`, http.StatusBadRequest)
		return
	}

	mutex.Lock()
	defer mutex.Unlock()

	index := -1

	for i, p := range products {
		if p.ID == id {
			index = i
			break
		}
	}

	if index == -1 {
		http.Error(w, `{"error":"Product not found"}`, http.StatusNotFound)
		return
	}

	switch r.Method {

	case http.MethodGet:
		json.NewEncoder(w).Encode(products[index])

	case http.MethodPut:
		var updated Product

		if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
			http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
			return
		}

		updated.ID = id
		products[index] = updated

		json.NewEncoder(w).Encode(updated)

	case http.MethodDelete:
		products = append(products[:index], products[index+1:]...)

		json.NewEncoder(w).Encode(map[string]string{
			"message": "Product deleted successfully",
		})

	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func main() {
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/products", productsHandler)
	http.HandleFunc("/products/", productByIDHandler)

	log.Println("Fresh Farm Dairy Products Service running on http://localhost:5004")

	log.Fatal(http.ListenAndServe(":5004", nil))
}
