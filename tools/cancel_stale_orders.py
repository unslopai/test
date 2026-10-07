import psycopg2
from datetime import datetime, timedelta

# Database connection parameters
DB_HOST = 'your_db_host'
DB_NAME = 'your_db_name'
DB_USER = 'your_db_user'
DB_PASSWORD = 'your_db_password'

# Connect to the database
conn = psycopg2.connect(
    host=DB_HOST,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

# Create a cursor object
cur = conn.cursor()

try:
    # Calculate the date 7 days ago from today
    seven_days_ago = datetime.now() - timedelta(days=7)
    
    # SQL query to cancel orders that are pending for more than 7 days
    query = """
    UPDATE your_orders_table
    SET status = 'cancelled'
    WHERE status = 'pending' AND created_at <= %s;
    """
    
    # Execute the query
    cur.execute(query, (seven_days_ago,))
    
    # Commit the changes
    conn.commit()
    
    print(f"Cancelled {cur.rowcount} stale orders.")
    
except psycopg2.Error as e:
    print(f"Error: {e}")
finally:
    # Close the cursor and connection
    if cur:
        cur.close()
    if conn:
        conn.close()

