# Database interaction functions
import os

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv(".env")
load_dotenv(".env.local", override=True)

def get_connection():
    url = os.environ.get("DATABASE_URL")
    if url:
        return psycopg2.connect(url)
    raise RuntimeError("DATABASE_URL is not configured.")

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
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # params fills the %s placeholders safely (prevents SQL injection).
            cur.execute(sql, params)
            # cur.description describes the result columns; we keep the names
            # so the web page can show proper table headers.
            rows = [dict(row) for row in cur.fetchall()]
        return rows
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

#--------------------------------------------------------------------------------#
# DATABASE FUNCTIONS FOR INTEGRATING WITH WITH THE WEB APP
#--------------------------------------------------------------------------------#

# ---------- READ (the R in CRUD) ----------
def get_volunteers():
    # retrieves all volunteers from the database.
    return run_query("SELECT * FROM volunteers ORDER BY volunteer_id;")

def get_community_members():
    # retrieves all community members from the database.
    return run_query("SELECT * FROM community_members ORDER BY member_id;")

def get_incident_reports():
    # retrieves all incident reports from the database.
    return run_query(
        """SELECT *
           FROM incident_reports
           ORDER BY report_timestamp DESC;"""
    )

def search_community_members_by_name(first, last):
    # searches for community members by first and last name (case-insensitive).
    return run_query(
        """SELECT *
           FROM community_members
           WHERE first_name ILIKE %s OR last_name ILIKE %s
           ORDER BY last_name, first_name;""",
        (f"%{first}%", f"%{last}%"),
    )

def search_incident_reports_by_id(report_id):
    # searches for incident reports by report_id (case-insensitive).
    return run_query(
        """SELECT *
           FROM incident_reports
           WHERE report_id = %s;""",
        (report_id,),
    )

# --------- CREATE (the C in CRUD) ----------
