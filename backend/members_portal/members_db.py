import psycopg2

from .. import database as db

# --------------------------------------------------------------------------------#
# DATABASE QUERIES (kept here, next to the endpoints that use them)
# --------------------------------------------------------------------------------#
def find_member_id(user_id):
    rows = db.run_query("SELECT member_id FROM community_members WHERE user_id = %s;", (user_id,))
    return rows[0]["member_id"] if rows else None


def create_member(user_id, first, last, street_address, city, state, tel_no):
    try:
        return db.run_change_returning(
            "INSERT INTO community_members "
            "(first_name, last_name, street_address, city, state, tel_no, user_id) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *;",
            (first, last, street_address, city, state, tel_no, user_id),
        )
    except psycopg2.errors.CheckViolation as e:
        raise db.InvalidTypeError("Phone number must look like 5405551234 or 540-555-1234") from e
    except psycopg2.errors.UniqueViolation as e:
        raise db.DuplicateValueError("This login already has a profile") from e


def reports_for_member(member_id):
    # Friendly names (coordinator, unit) instead of raw ids.
    return db.run_query(
        """SELECT i.report_id, i.type, i.address, i.city, i.state,
                  i.report_timestamp, i.description, i.status, i.image_url,
                  c.first_name || ' ' || c.last_name AS coordinator_name,
                  u.unit_name,
                  h.status AS help_request_status
           FROM incident_reports i
           LEFT JOIN response_coordinators c ON c.coordinator_id = i.coordinator_id
           LEFT JOIN help_requests h ON h.report_id = i.report_id
           LEFT JOIN response_units u ON u.unit_id = h.unit_id
           WHERE i.member_id = %s
           ORDER BY i.report_timestamp DESC;""",
        (member_id,),
    )


def report_owner(report_id):
    rows = db.run_query("SELECT member_id FROM incident_reports WHERE report_id = %s;", (report_id,))
    return rows[0]["member_id"] if rows else None


def delete_report_of_member(report_id, member_id):
    # Deletes only if the report belongs to this member. Returns rows deleted.
    return db.run_change(
        "DELETE FROM incident_reports WHERE report_id = %s AND member_id = %s;",
        (report_id, member_id),
    )


def all_posts(viewer_member_id):
    # is_mine tells the page which posts the viewer wrote (so it can offer "delete").
    return db.run_query(
        """SELECT p.post_id, p.member_id, p.post_title, p.post_content,
                  p.post_timestamp, p.media,
                  m.first_name, m.last_name,
                  (p.member_id = %s) AS is_mine
           FROM posts p
           JOIN community_members m ON m.member_id = p.member_id
           ORDER BY p.post_timestamp DESC;""",
        (viewer_member_id,),
    )


def add_post(member_id, title, content):
    return db.run_change_returning(
        "INSERT INTO posts (member_id, post_title, post_content) "
        "VALUES (%s, %s, %s) RETURNING *;",
        (member_id, title, content),
    )


def post_owner(post_id):
    rows = db.run_query("SELECT member_id FROM posts WHERE post_id = %s;", (post_id,))
    return rows[0]["member_id"] if rows else None


def remove_post(post_id):
    return db.run_change("DELETE FROM posts WHERE post_id = %s;", (post_id,))

