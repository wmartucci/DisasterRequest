import psycopg2

from .. import database as db

# --------------------------------------------------------------------------------#
# DATABASE QUERIES (kept here, next to the endpoints that use them)
# --------------------------------------------------------------------------------#
def all_users():
    # Every login, with the role-specific details the admin page shows.
    # password_hash is left out on purpose.
    return db.run_query(
        """SELECT u.user_id, u.username, u.first_name, u.last_name, u.role, u.email,
                  m.member_id, m.city, m.state,
                  rc.coordinator_id, rc.organization,
                  a.admin_id
           FROM users u
           LEFT JOIN community_members m ON m.user_id = u.user_id
           LEFT JOIN response_coordinators rc ON rc.user_id = u.user_id
           LEFT JOIN admin a ON a.user_id = u.user_id
           ORDER BY u.user_id;"""
    )


def create_user(first_name, last_name, role, username, password_hash, email,
                organization=None, street_address=None, city=None, state=None):
    """Creates the users row and, where the role needs one, its role row, in one transaction.

    - Response Coordinator: response_coordinators row (organization is required).
    - Admin: admin row.
    - Community Member: community_members row only if an address was given;
      otherwise the member fills in their profile on first sign-in.
    """
    conn = db.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username, password_hash, first_name, last_name, role, email) "
                "VALUES (%s, %s, %s, %s, %s, %s) "
                "RETURNING user_id, username, first_name, last_name, role, email;",
                (username, password_hash, first_name, last_name, role, email),
            )
            columns = [desc[0] for desc in cur.description]
            row = cur.fetchone()
            user_id = row[0]

            if role == "Response Coordinator":
                cur.execute(
                    "INSERT INTO response_coordinators (user_id, organization) VALUES (%s, %s);",
                    (user_id, organization),
                )
            elif role == "Admin":
                cur.execute("INSERT INTO admin (user_id) VALUES (%s);", (user_id,))
            elif role == "Community Member" and street_address:
                cur.execute(
                    "INSERT INTO community_members (street_address, city, state, user_id) "
                    "VALUES (%s, %s, %s, %s);",
                    (street_address, city, state, user_id),
                )
        conn.commit()
        return dict(zip(columns, row))
    except psycopg2.errors.UniqueViolation as e:
        conn.rollback()
        if e.diag.constraint_name == "user_email_unique":
            raise db.DuplicateValueError(f"An account with email {email} already exists") from e
        raise db.DuplicateValueError(f"Username {username} already exists") from e
    except psycopg2.errors.CheckViolation as e:
        conn.rollback()
        raise db.InvalidTypeError(f"Value breaks the rule '{e.diag.constraint_name}'") from e
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_password(user_id, password_hash):
    # Sets a new password and voids any outstanding reset links for the user.
    # Returns the number of users updated (0 = no such user).
    conn = db.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE user_id = %s;",
                (password_hash, user_id),
            )
            count = cur.rowcount
            cur.execute("DELETE FROM password_reset_tokens WHERE user_id = %s;", (user_id,))
        conn.commit()
        return count
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_user(user_id):
    # ON DELETE CASCADE removes the role row (and a member's posts and comments).
    # Returns rows deleted (0 = no such user).
    try:
        return db.delete_user(user_id)
    except psycopg2.errors.NotNullViolation as e:
        # resources.member_id is NOT NULL but its foreign key says ON DELETE SET NULL,
        # so a member who still has resources can't be removed.
        raise db.DuplicateValueError(
            "This user still has records that depend on them (e.g. resources) and can't be deleted"
        ) from e
    except psycopg2.errors.ForeignKeyViolation as e:
        raise db.DuplicateValueError(
            "This user still has records that depend on them and can't be deleted"
        ) from e
