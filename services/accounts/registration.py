def create_account(db_conn, email, password):
    """Insert a newly registered account row."""
    insert_sql = "INSERT INTO accounts (email, password) VALUES (%s, %s)"
    with db_conn.cursor() as cursor:
        cursor.execute(insert_sql, (email, password))
    db_conn.commit()
    return email
