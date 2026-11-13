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
#                         DATABASE QUERY FUNCTIONS
# --------------------------------------------------------------------------------#
#-----CREATE------------------#
def create_community_member(user_id, street_address, city, state, tel_no):
    # create a community member profile for an existing users row. Names live in users.
    return run_change_returning(
        "INSERT INTO community_members (street_address, city, state, tel_no, user_id) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING *;",
        (street_address, city, state, tel_no, user_id),
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
    # create a new incident report in the database. Returns the newly created row.
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

def create_password_reset_token(user_id, token):
    # creates a new password reset token in the database.
    # Any older tokens for this user are deleted first, so only the newest
    # emailed link works. expires_at is filled in by PostgreSQL (now() + 1 hour).
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM password_reset_tokens WHERE user_id = %s;", (user_id,))
            cur.execute(
                "INSERT INTO password_reset_tokens (user_id, token) "
                "VALUES (%s, %s) RETURNING *;",
                (user_id, token),
            )
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        conn.commit()  # delete + insert are saved together
        return columns, rows
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

#-----READ------------------#
def get_community_members():
    # retrieves all community members from the database.
    # Names come from users, joined on user_id.
    return run_query(
        """SELECT m.*, u.first_name, u.last_name
           FROM community_members m
           JOIN users u ON u.user_id = m.user_id
           ORDER BY m.member_id;"""
    )

def search_community_members_by_name(first, last):
    # searches for community members by first and last name (case-insensitive).
    return run_query(
        """SELECT m.*, u.first_name, u.last_name
           FROM community_members m
           JOIN users u ON u.user_id = m.user_id
           WHERE u.first_name ILIKE %s OR u.last_name ILIKE %s
           ORDER BY u.last_name, u.first_name;""",
        (f"%{first}%", f"%{last}%"),
    )
def get_volunteers():
    # retrieves all volunteers from the database.
    return run_query("SELECT * FROM volunteers ORDER BY volunteer_id;")

def get_incident_reports():
    # retrieves all incident reports from the database.
    return run_query("""
    SELECT i.report_id,
           i.coordinator_id,
           i.member_id,
           u.first_name,
           u.last_name,
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
    JOIN users u ON u.user_id = m.user_id
    ORDER BY i.report_timestamp DESC;
""")

def search_incident_reports_by_id(report_id):
    # searches for incident reports by report_id (case-insensitive).
    return run_query(
        "SELECT * FROM incident_reports WHERE report_id = %s;", (f"%{report_id}%",)
    )

def get_user_id_by_email(email):
    # retrieves the user_id for a given email address.
    rows = run_query(
        "SELECT user_id FROM users WHERE email = %s;",
        (email,),
    )
    return rows[0]["user_id"] if rows else None

#-----UPDATE------------------#
def redeem_password_reset_token(token, new_password_hash):
    # Uses a password reset token (its SHA-256 hash) to set a new password.
    # Returns True if the password was changed, False if the token doesn't
    # exist or has expired. Everything happens in one transaction:
    #   1. find the token and lock its row (FOR UPDATE), only if not expired
    #   2. update the user's password
    #   3. delete all of that user's reset tokens, so the link can't be reused
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM password_reset_tokens "
                "WHERE token = %s AND expires_at > now() "
                "FOR UPDATE;",
                (token,),
            )
            row = cur.fetchone()
            if row is None:
                conn.rollback()
                return False
            user_id = row[0]

            cur.execute(
                "UPDATE users SET password_hash = %s WHERE user_id = %s;",
                (new_password_hash, user_id),
            )
            cur.execute("DELETE FROM password_reset_tokens WHERE user_id = %s;", (user_id,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def update_incident_report_status(report_id, new_status):          
    # updates the status of an incident report by report_id.
    return run_change(
        "UPDATE incident_reports SET status = %s WHERE report_id = %s;",
        (new_status, report_id),
    )


#-----DELETE------------------#
def delete_user(user_id):
    # Deletes a login. ON DELETE CASCADE removes its admin / community_members row
    # (and that member's posts and comments). Returns rows deleted (0 = no such user).
    return run_change("DELETE FROM users WHERE user_id = %s;", (user_id,))

def delete_community_member(member_id):
    # Deletes a community member by deleting their login; the profile row cascades.
    # Deleting only the community_members row would leave a login with no profile.
    return run_change(
        "DELETE FROM users WHERE user_id = "
        "(SELECT user_id FROM community_members WHERE member_id = %s);",
        (member_id,),
    )

def delete_incident_report(report_id):
    # deletes an incident report by report_id.
    return run_change("DELETE FROM incident_reports WHERE report_id=%s;", (report_id,))


# ---------- Authentication -------------
def create_user(first_name, last_name, role, username, password_hash, street_address, city, state, tel_no, email):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Create the login account
            cur.execute(
                "INSERT INTO users (username, password_hash, first_name, last_name, role, email) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING *;",
                (username, password_hash, first_name, last_name, role, email),
            )
            columns = [desc[0] for desc in cur.description] 
            rows = cur.fetchall()
            user_id = rows[0][0]
            
            # 2. Create the matching row for the user's role
            if role == "Community Member":
                cur.execute("INSERT INTO community_members (street_address, city, state, tel_no, user_id) "
                        "VALUES (%s, %s, %s, %s, %s) RETURNING *;",
                        (street_address, city, state, tel_no, user_id),
                    )
            # 2.1 Create the matching row for the user's role
            if role == "Response Coordinator":
                print("COORDINATOR INSERT ->", first_name, last_name, tel_no, email)
                cur.execute("INSERT INTO response_coordinators (first_name, last_name, tel_no, email, user_id) "
                        "VALUES (%s, %s, %s, %s, %s) RETURNING *;",
                        (first_name, last_name, tel_no, email, user_id),
                    )
            # 2.2 Create the matching row for the user's role
            if role == "Admin":
                cur.execute("INSERT INTO admin (tel_no, user_id) "
                        "VALUES (%s, %s) RETURNING *;",
                        (tel_no, user_id),
                    )

        conn.commit()  # saves BOTH rows at once
        return columns, rows

    except psycopg2.errors.UniqueViolation as e:
        conn.rollback()
        raise DuplicateValueError(f"Username {username} already exists") from e
    except psycopg2.errors.CheckViolation as e:
        conn.rollback()
        # Name the rule that failed (e.g. member_valid_tel_no), not just "role"
        raise InvalidTypeError(f"Value breaks the rule '{e.diag.constraint_name}'") from e
    except Exception:
        conn.rollback()  # undo the users row too
        raise
    finally:
        conn.close()

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
        final_query = "SELECT json_build_object('type', 'FeatureCollection', 'features', COALESCE(json_agg(ST_AsGeoJSON(t.*)::json),'[]'::json)) FROM (" + final_query + ") as t;"
        result = run_query(final_query, params=params)
        if 'json_build_object' in result[0]:
            return result[0]['json_build_object']
        else:
            return result
    
    final_query = final_query + ";"

    return run_query(final_query, params=params)

def get_incident_stats(district_id: int = None):
    query = """SELECT COUNT(*) AS total_incidents, 
                                   COUNT(*) FILTER (WHERE i.type = 'Flood') AS flood_count, 
                                   COUNT(*) FILTER (WHERE i.type = 'Fallen Tree') AS tree_count, 
                                   COUNT(*) FILTER (WHERE i.type = 'Power') AS power_count, 
                                   COUNT(*) FILTER (WHERE i.type = 'Fire') AS fire_count,
                                   COUNT(*) FILTER (WHERE i.status = 'Pending Assistance') AS pending_count, 
                                   COUNT(*) FILTER (WHERE i.status = 'Help Requested') AS requested_count, 
                                   COUNT(*) FILTER (WHERE i.status = 'Unit in Response') AS in_response_count, 
                                   COUNT(*) FILTER (WHERE i.status = 'Resolved') AS resolved_count 
                            FROM incident_reports i"""
    if district_id is not None:
        query = query + f""" JOIN districts d ON ST_Within(i.location, d.boundary)
                                 WHERE d.district_id = {district_id}"""
    return run_query(query)

def get_districts(include_counts = False):
    if not include_counts:
        result = run_query("""SELECT json_build_object(
                                'type', 'FeatureCollection', 
                                'features', COALESCE(
                                    json_agg(ST_AsGeoJSON(t.*)::json),
                                    '[]'::json
                                )
                            )
                            FROM (
                                SELECT * FROM districts
                            ) AS t""")
        if 'json_build_object' in result[0]:
            return result[0]['json_build_object']
        else:
            return result
    else:
        result = run_query("""SELECT json_build_object(
                                'type', 'FeatureCollection',
                                'features', json_agg(ST_AsGeoJSON(t.*)::json)
                            )
                            FROM (
                            SELECT 
                                d.district_id,
                                d.district_name, 
                                d.boundary,
                                COUNT(*) AS total_incidents,
                                COUNT(*) FILTER (WHERE i.type = 'Flood') AS flood_count,
                                COUNT(*) FILTER (WHERE i.type = 'Fallen Tree') AS tree_count,
                                COUNT(*) FILTER (WHERE i.type = 'Power') AS power_count,
                                COUNT(*) FILTER (WHERE i.type = 'Fire') AS fire_count,
                                COUNT(*) FILTER (WHERE i.status = 'Pending Assistance') AS pending_count,
                                COUNT(*) FILTER (WHERE i.status = 'Help Requested') AS requested_count,
                                COUNT(*) FILTER (WHERE i.status = 'Unit in Response') AS in_response_count,
                                COUNT(*) FILTER (WHERE i.status = 'Resolved') AS resolved_count
                            FROM districts d
                            LEFT JOIN incident_reports i ON ST_Contains(d.boundary, i.location)
                            GROUP BY d.district_id, d.district_name
                            ORDER BY d.district_id ASC
                            ) AS t;""")
        if 'json_build_object' in result[0]:
            return result[0]['json_build_object']
        else:
            return result

def get_help_requests():
    return run_query("""SELECT h.request_id,
                               h.report_id,
                               h.request_timestamp,
                               h.status AS request_status,
                               i.type,
                               i.description,
                               i.report_timestamp,
                               u.unit_name
                        FROM help_requests h 
                        JOIN incident_reports i ON h.report_id = i.report_id 
                        JOIN response_units u ON h.unit_id = u.unit_id""")

def get_help_request_counts():
    return run_query("""SELECT status, COUNT(*)
                        FROM help_requests
                        GROUP BY status""")

def get_resources():
    return run_query("""SELECT resource_name, resource_type, quantity FROM resources""")