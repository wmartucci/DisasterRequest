# Database interaction functions




import psycopg2 # for PostgreSQL database connection
import os # for environment variable access

def get_connection():
    # If DATABASE_URL is set, connect to the cloud database (Neon).
    # Otherwise, connect to the local Docker database as before.
    url = os.environ.get("DATABASE_URL") 
    if url:
        return psycopg2.connect(url)      # cloud database (Neon)
    return "Set DATABASE_URL environment variable to connect to the cloud database (Neon)."

    # Otherwise, connect to the local Docker database as before.
    # We can test database modifications locally before deploying to the cloud.
    # We just need to set up a docker-compose.yml file to run a PostgreSQL database in a Docker container.
    #return psycopg2.connect(**DB_CONFIG)  # local Docker database

def run_query(sql, params=None):
    """Run a SELECT and return (column_names, rows).

    @param sql: a SQL SELECT statement with %s placeholders for parameters
    @param params: a tuple of parameters to fill the placeholders
    @return: a tuple of (column_names, rows), where column_names is a list of strings 
            and rows is a list of tuples"""

    conn = get_connection()
    try:
        # A cursor is the object that sends SQL and holds the results.
        # "with" closes the cursor automatically when the block ends.
        with conn.cursor() as cur:
            # params fills the %s placeholders safely (prevents SQL injection).
            cur.execute(sql, params)
            # cur.description describes the result columns; we keep the names
            # so the web page can show proper table headers.
            columns = [desc[0] for desc in cur.description]
            # fetchall() brings every result row back into Python as a list of tuples.
            rows = cur.fetchall()
        return columns, rows
    finally:
        # "finally" runs even if the query failed, so the connection is
        # always closed. Leaving connections open wastes database resources.
        conn.close()

def run_change(sql, params=None):
    """Run an INSERT/UPDATE/DELETE. Returns the number of rows affected.
    
    @param sql: a SQL statement with %s placeholders for parameters
    @param params: a tuple of parameters to fill the placeholders
    @return: the number of rows affected by the change"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            # rowcount = how many rows were changed. The page uses it to tell
            # the user "No owner with that ID" when nothing matched.
            count = cur.rowcount
        # commit() makes the change permanent. PostgreSQL keeps changes in a
        # transaction until you commit; without this line they are thrown away.
        conn.commit()
        return count
    except Exception:
        # Something failed (e.g. a duplicate email). rollback() cancels the
        # half-finished change so the database is never left broken...
        conn.rollback()
        # ...and raise passes the error on to app.py, which shows a message.
        raise
    finally:
        conn.close()
