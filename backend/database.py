# Database interaction functions
import os

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv(".env")
load_dotenv(".env.local", override=True)

class DuplicateValueError(Exception):
    pass

class InvalidTypeError(Exception):
    pass

# --------------------------------------------------------------------------------#
# FUNCTIONS TO ALLOW QUERYING DATABASE
# --------------------------------------------------------------------------------#


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
        # connection always needs to be closed, even if an error occurred
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


def run_change_returning(sql, params=None):
    """Run an INSERT/UPDATE/DELETE ... RETURNING and return (column_names, rows).

    RETURNING makes PostgreSQL send back the row it just created or changed,
    including values it generated itself (like an auto-increment ID). An API
    usually returns that row to the client, so this saves a second query.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        conn.commit()
        return columns, rows
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# --------------------------------------------------------------------------------#
# SPECIFIC DATABASE QUERY FUNCTIONS
# --------------------------------------------------------------------------------#


# --------- CREATE ---------
def create_community_member(first, last, street_address, city, state, tel_no):
    # create a new community member in the database. Returns the newly created row.
    return run_change_returning(
        "INSERT INTO community_members (first_name, last_name, street_address, city, state, tel_no) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING *;",
        (first, last, street_address, city, state, tel_no),
    )


def create_incident_report(
    member_id,
    type,
    address,
    city,
    state,
    image_url,
    description,
    status,
    latitude,
    longitude,
):
    return run_change_returning(
        "INSERT INTO incident_reports (member_id, type, address, city, state, image_url, description, status, location) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)) RETURNING *;",
        (
            member_id,
            type,
            address,
            city,
            state,
            image_url,
            description,
            status,
            longitude,
            latitude,
        ),
    )


# --------- READ ----------
def get_volunteers():
    # retrieves all volunteers from the database.
    return run_query("SELECT * FROM volunteers ORDER BY volunteer_id;")


def get_community_members():
    # retrieves all community members from the database.
    return run_query("SELECT * FROM community_members ORDER BY member_id;")


def get_incident_reports():
    # retrieves all incident reports from the database.
    return run_query("""
    SELECT i.report_id,
           i.coordinator_id,
           i.member_id,
           m.first_name,
           m.last_name,
           m.tel_no,
           i.type,
           i.address,
           i.city,
           i.state,
           i.report_timestamp,
           i.image_url,
           i.description,
           i.status,
           ST_Y(i.location) AS latitude,
           ST_X(i.location) AS longitude
    FROM incident_reports i
    JOIN community_members m ON i.member_id = m.member_id
    ORDER BY i.report_timestamp DESC;
""")


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
        "SELECT * FROM incident_reports WHERE report_id = %s;", (f"%{report_id}%",)
    )


# --------- UPDATE ----------
def update_incident_report_status(report_id, new_status):
    # updates the status of an incident report by report_id.
    return run_change(
        "UPDATE incident_reports SET status = %s WHERE report_id = %s;",
        (new_status, report_id),
    )


# --------- DELETE ----------
def delete_community_member(member_id):
    # deletes a community member by member_id.
    return run_change("DELETE FROM community_members WHERE member_id=%s;", (member_id,))


def delete_incident_report(report_id):
    # deletes an incident report by report_id.
    return run_change("DELETE FROM incident_reports WHERE report_id=%s;", (report_id,))

# ---------- Authentication -------------
def create_user(first_name, last_name, role, username, password_hash):
    try:
        new_user_result = run_change_returning("INSERT INTO users(username, password_hash, first_name, last_name, role) VALUES (%s, %s, %s, %s, %s) RETURNING *;", 
                                (username, password_hash, first_name, last_name, role))
        return new_user_result
    except psycopg2.errors.UniqueViolation as e:
        raise DuplicateValueError(f"Username {username} already exists") from e
    except psycopg2.errors.CheckViolation as e:
        raise InvalidTypeError(f"Role type '{role}' is invalid") from e

def get_password_hash(user_name):
    result = run_query("SELECT user_id, password_hash, role FROM users WHERE username = %s;", (user_name,))
    return result[0] if result else None

def get_user_details(user_id):
    result = run_query("SELECT user_id, first_name, last_name, username, role FROM users WHERE user_id = %s", (user_id,))
    return result[0] if result else None

def get_incidents(type, status, district_id, as_geojson):
    fields = ["report_id", "coordinator_id", "member_id", "type", "address", "city", "state", "report_timestamp", "image_url", "description", "status", "location"]
    if district_id:
        fields = map(lambda x: "i." + x, fields)
    
    select_query = "SELECT " + ', '.join(fields) + " FROM incident_reports"
    params = None
    where_clause = None

    if type and not status:
        where_clause = "type = %s"
        params = (type, )
    elif status and not type:
        where_clause = "status = %s"
        params = (status, )
    elif type and status:
        where_clause = "type = %s AND status = %s"
        params = (type, status)

    final_query = select_query

    if district_id:
        select_query = select_query + " i INNER JOIN districts d ON ST_Within(i.location, d.boundary) WHERE d.district_id = %s"
        if params:
            params = (district_id,) + params
        else:
            params = (district_id,)
        if where_clause:
            final_query = select_query + " AND " + where_clause
        else:
            final_query = select_query
    else:
        if where_clause:
            final_query = select_query + " WHERE " + where_clause

    if as_geojson:
        final_query = "SELECT json_build_object('type', 'FeatureCollection', 'features', json_agg(ST_AsGeoJSON(t.*)::json)) FROM (" + final_query + ") as t;"
        result = run_query(final_query, params=params)
        if 'json_build_object' in result[0]:
            return result[0]['json_build_object']
        else:
            return result
    
    final_query = final_query + ";"

    return run_query(final_query, params=params)