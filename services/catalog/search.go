package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

// Product represents the structure of a product.
type Product struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

var db *sql.DB

func init() {
	var err error
	// Set up database connection
	db, err = sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatalf("Error pinging the database: %v", err)
	}
}

// searchHandler handles GET requests for searching products.
func searchHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	sortBy := r.URL.Query().Get("sort")

	if q == "" || sortBy == "" {
		http.Error(w, "Search term and sort field are required", http.StatusBadRequest)
		return
	}

	// Construct the SQL query with sorting
	query := fmt.Sprintf("SELECT id, name, price FROM products WHERE name ILIKE '%%%s%%' ORDER BY %s", q, sortBy)

	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, "Error querying database", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		err := rows.Scan(&p.ID, &p.Name, &p.Price)
		if err != nil {
			http.Error(w, "Error scanning database rows", http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error processing database rows", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func main() {
	http.HandleFunc("/search", searchHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
