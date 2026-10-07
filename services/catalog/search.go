package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/go-sql-driver/mysql"
)

// Product represents the structure of our products table.
type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Category    string  `json:"category"`
}

// Global database connection pool
var db *sql.DB

func main() {
	var err error

	// TODO: Replace with your actual database connection string
	// Format: "username:password@tcp(127.0.0.1:3306)/dbname?parseTime=true"
	dsn := "root:root@tcp(127.0.0.1:3306)/shop_db?parseTime=true"

	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}
	defer db.Close()

	// Verify connection
	if err = db.Ping(); err != nil {
		log.Fatalf("Error connecting to database: %v", err)
	}

	// Setup HTTP route
	http.HandleFunc("/products", searchProductsHandler)

	log.Println("Server is running on http://localhost:8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func searchProductsHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Get query parameters
	query := r.URL.Query().Get("q")
	sortBy := r.URL.Query().Get("sort")

	// 2. Validate and sanitize the 'sort' parameter to prevent SQL Injection.
	// Only allow specific column names to be sorted.
	allowedSortColumns := map[string]string{
		"name":  "name",
		"price": "price",
		"id":    "id",
	}

	sqlSortColumn, exists := allowedSortColumns[sortBy]
	if !exists {
		// Default sort if none or invalid provided
		sqlSortColumn = "id"
	}

	// 3. Build the SQL query safely using parameterized inputs for the search term
	sqlQuery := `
		SELECT id, name, description, price, category 
		FROM products 
		WHERE name LIKE ? OR description LIKE ? 
		ORDER BY ` + sqlSortColumn + ` ASC`

	// Add wildcards for the SQL LIKE operator
	searchPattern := "%" + query + "%"

	rows, err := db.Query(sqlQuery, searchPattern, searchPattern)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// 4. Parse rows into structs
	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Category); err != nil {
			http.Error(w, "Error parsing data: "+err.Error(), http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}

	// Handle case where no products were found (return empty array instead of null)
	if products == nil {
		products = []Product{}
	}

	// 5. Return as JSON
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(products); err != nil {
		log.Printf("Error encoding JSON: %v", err)
	}
}
