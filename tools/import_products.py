import csv
import os
import sys
import psycopg2
from psycopg2 import sql


def get_db_connection():
    """Establish a connection to the PostgreSQL database using environment variables or defaults."""
    try:
        connection = psycopg2.connect(
            dbname=os.getenv("DB_NAME", "your_database_name"),
            user=os.getenv("DB_USER", "your_database_user"),
            password=os.getenv("DB_PASSWORD", "your_database_password"),
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
        )
        return connection
    except psycopg2.OperationalError as e:
        print(f"Database connection failed: {e}")
        sys.exit(1)


def import_csv_to_postgres(csv_file_path):
    """Reads a CSV file and bulk inserts its contents into the Postgres 'products' table."""
    if not os.path.exists(csv_file_path):
        print(f"Error: The file '{csv_file_path}' does not exist.")
        return

    print(f"Opening CSV file: {csv_file_path}")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        with open(csv_file_path, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)  # Read the header row

            print(f"CSV Headers detected: {headers}")
            print("Importing data...")

            # Use Postgres COPY command for extremely fast bulk inserts
            # Assumes CSV columns map directly to table columns: (name, description, price, stock)
            # Adjust the table name and columns as needed for your schema.
            cursor.copy_expert(
                sql.SQL(
                    "COPY products ({}) FROM STDIN WITH CSV HEADER".format(
                        ", ".join(headers)
                    )
                ),
                f,
            )

        # Commit the transaction
        conn.commit()
        print("Successfully imported products into the database!")

    except Exception as e:
        # Roll back in case of error
        conn.rollback()
        print(f"An error occurred during import: {e}")

    finally:
        # Always close the cursor and connection
        cursor.close()
        conn.close()
        print("Database connection closed.")


if __name__ == "__main__":
    print("=== PostgreSQL Product CSV Importer ===")

    # Get CSV file path from user input
    user_file_path = input("Enter the path to your CSV file: ").strip()

    # Remove surrounding quotes if the user dragged and dropped the file into the terminal
    user_file_path = user_file_path.strip("'\"")

    import_csv_to_postgres(user_file_path)
