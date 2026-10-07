import csv
import psycopg2

# Function to connect to the PostgreSQL database
def connect_to_db():
    try:
        conn = psycopg2.connect(
            host="your_host",
            database="your_database",
            user="your_user",
            password="your_password"
        )
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        exit()

# Function to insert data into the products table
def insert_product(cursor, product_data):
    try:
        cursor.execute("""
            INSERT INTO products (name, price, category) VALUES (%s, %s, %s)
        """, (product_data['name'], product_data['price'], product_data['category']))
        return True
    except Exception as e:
        print(f"Error inserting product: {e}")
        return False

# Main function to handle the CSV import and database insertion
def main():
    # Connect to the PostgreSQL database
    conn = connect_to_db()
    cursor = conn.cursor()

    # Get the CSV file path from the user
    csv_file_path = input("Please enter the path to your CSV file: ")

    # Open the CSV file and read data
    try:
        with open(csv_file_path, mode='r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                product_data = {
                    'name': row['name'],
                    'price': float(row['price']),
                    'category': row['category']
                }
                if insert_product(cursor, product_data):
                    print(f"Inserted: {product_data}")
    except Exception as e:
        print(f"Error reading CSV file: {e}")

    # Commit the changes and close the connection
    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
