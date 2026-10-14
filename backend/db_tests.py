# This test file was intended for a mostly empty database during early implementations


import database


#checking connection to Neon
def test_connection():
    success = False
    try:
        conn = database.get_connection()
        assert conn is not None
        conn.close()
        success = True
        if success:
            print("Connection to Neon successful!")
    except Exception as e:
        assert False, f"Connection failed: {e}"

def test_create_community_member():
    # Test the create_community_member function
    try:
        first = "John"
        last = "Doe"
        street_address = "123 Main St"
        city = "Anytown"
        state = "CA"
        tel_no = "800-555-1234"

        columns, rows = database.create_community_member(first, last, street_address, city, state, tel_no)
        assert isinstance(columns, list), "Columns should be a list"
        assert isinstance(rows, list), "Rows should be a list"

        print("Columns:", columns)
        print("Rows:", rows)

        print("create_community_member test passed!")
    except Exception as e:
        assert False, f"create_community_member test failed: {e}"

def test_delete_community_member():
    try:
        deleted = database.delete_community_member(4)
        assert deleted is not None, "Something went wrong when deleting the row, nothing got returned"
        assert deleted == 1, "Only one record should have deleted"

        print("number of rows deleted: ", deleted)
    except Exception as e:
        assert False, f"delete_community_member failed: {e}"



def test_get_community_members():
    # Test the get_community_members function
    try:
        columns, rows = database.get_community_members()
        assert isinstance(columns, list), "Columns should be a list"
        assert isinstance(rows, list), "Rows should be a list"

        print("Columns:", columns)
        print("Rows:", rows)

        print("get_community_members test passed!")
    except Exception as e:
        assert False, f"get_community_members test failed: {e}"


test_connection()
test_create_community_member()
test_delete_community_member()

#test_get_community_members()