package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/lib/pq" // PostgreSQL driver (run `go get github.com/lib/pq`)
)

// Product represents the structure of our product table.
type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Stock       int     `json:"stock"`
}

// App holds the database connection to be shared with handlers.
type App struct {
	DB *sql.DB
}

// getProductsHandler handles GET /products?name=...
func (a *App) getProductsHandler(w http.ResponseWriter, r *http.Request) {
	// Ensure it's a GET request
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get the 'name' query parameter
	nameQuery := r.URL.Query().Get("name")
	if nameQuery == "" {
		http.Error(w, "Missing 'name' query parameter", http.StatusBadRequest)
		return
	}

	// SQL query using ILIKE for case-insensitive partial matching (PostgreSQL specific).
	// For MySQL, use: SELECT id, name, description, price, stock FROM products WHERE name LIKE ?
	// For SQLite, use LIKE (case-insensitive for ASCII by default).
	query := `SELECT id, name, description, price, stock FROM products WHERE name ILIKE $1`

	// We use wildcards '%' so it searches for products containing the given string.
	// If you want an exact match, just use `nameQuery`.
	rows, err := a.DB.Query(query, "%"+nameQuery+"%")
	if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Parse rows into a slice of Products
	products := []Product{}
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Stock); err != nil {
			log.Printf("Row scanning error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}

	// Check for errors from iterating over rows
	if err := rows.Err(); err != nil {
		log.Printf("Row iteration error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Set Content-Type header to application/json and write response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Encode the products slice directly to the HTTP response writer
	if err := json.NewEncoder(w).Encode(products); err != nil {
		log.Printf("JSON encoding error: %v", err)
	}
}

func main() {
	// 1. Setup Database Connection
	// Replace this connection string with your actual database credentials.
	connStr := "postgres://username:password@localhost:5432/dbname?sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// Verify connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	app := &App{DB: db}

	// 2. Register HTTP Handler
	http.HandleFunc("/products", app.getProductsHandler)

	// 3. Start Server
	port := ":8080"
	log.Printf("Server is running on port %s...", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
