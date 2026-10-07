#!/usr/bin/env python3
"""
cancel_stale_orders.py
----------------------
A script to cancel all orders in a PostgreSQL database that have been
in 'pending' status for more than 7 days.
"""

import logging
import os
import sys
from datetime import datetime, timezone
import psycopg2
from psycopg2 import OperationalError

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
# It is best practice to load credentials from environment variables.
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "your_database_name")
DB_USER = os.getenv("DB_USER", "your_database_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "your_database_password")
DB_PORT = os.getenv("DB_PORT", "5432")

# Adjust these table and column names to match your database schema
TABLE_NAME = "orders"
STATUS_COLUMN = "status"
DATE_COLUMN = "created_at"
PENDING_STATUS_VALUE = "pending"
CANCELLED_STATUS_VALUE = "cancelled"
STALE_DAYS = 7

# ---------------------------------------------------------------------------
# LOGGING SETUP
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
        # Optional: Add a FileHandler if you want to log to a file
        # logging.FileHandler('/var/log/cancel_stale_orders.log')
    ],
)


def cancel_stale_orders():
    connection = None
    try:
        logging.info("Connecting to the database...")
        connection = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
        )

        with connection.cursor() as cursor:
            # Construct the SQL query securely using parameters
            # We use NOW() - INTERVAL '7 days' to compare timestamps at the DB level
            update_query = f"""
                UPDATE {TABLE_NAME}
                SET {STATUS_COLUMN} = %s, updated_at = %s
                WHERE {STATUS_COLUMN} = %s
                  AND {DATE_COLUMN} < NOW() - INTERVAL '%s days';
            """

            current_time = datetime.now(timezone.utc)

            logging.info(
                f"Executing query to cancel orders '{PENDING_STATUS_VALUE}' "
                f"older than {STALE_DAYS} days..."
            )

            cursor.execute(
                update_query,
                (
                    CANCELLED_STATUS_VALUE,
                    current_time,
                    PENDING_STATUS_VALUE,
                    STALE_DAYS,
                ),
            )

            # Get the number of rows affected
            row_count = cursor.rowcount

            # Commit the transaction
            connection.commit()
            logging.info(
                f"Successfully cancelled {row_count} stale order(s)."
            )

    except OperationalError as e:
        logging.error(f"Database operational error: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        if connection:
            connection.rollback()
        sys.exit(1)
    finally:
        if connection:
            connection.close()
            logging.info("Database connection closed.")


if __name__ == "__main__":
    cancel_stale_orders()
