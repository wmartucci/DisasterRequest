CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL
    CONSTRAINT role_type_valid
    CHECK (role in ('Community Member', 'Response Coordinator', 'Responder', 'Volunteer', 'Admin')),
  email TEXT NOT NULL
    CONSTRAINT user_email_unique UNIQUE
    CONSTRAINT user_email_format CHECK (
        email LIKE '_%@_%._%'
    )
);

-- Role table for Admins. Names, email and login details live in users,
-- like community_members and response_coordinators.
CREATE TABLE admin (
    admin_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE community_members (
    member_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL
);

CREATE TABLE response_coordinators (
    user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    coordinator_id SERIAL PRIMARY KEY,
    organization TEXT NOT NULL
);

CREATE TABLE incident_reports (
    report_id SERIAL PRIMARY KEY,
    coordinator_id INTEGER 
        CONSTRAINT report_cooordinator_fk
        REFERENCES response_coordinators(coordinator_id)
        ON DELETE SET NULL,
    member_id INTEGER
        CONSTRAINT report_member_fk
        REFERENCES community_members(member_id)
        ON DELETE SET NULL,
    type TEXT NOT NULL 
        CONSTRAINT report_valid_type
        CHECK(type IN('Fallen Tree', 'Flood', 'Fire', 'Power')),
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    report_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    image_url TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Assistance'
        CONSTRAINT report_valid_status
        CHECK(status IN ('Pending Assistance', 'Help Requested', 'Unit in Response', 'Resolved')),
    location GEOMETRY(POINT, 4326) NOT NULL
);

CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL
        CONSTRAINT posts_members_fk
        REFERENCES community_members(member_id)
        ON DELETE CASCADE,
    post_title VARCHAR(50) NOT NULL,
    post_content VARCHAR(3000) NOT NULL,
    post_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    media VARCHAR(70)
);

CREATE TABLE comments (
    comment_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL
        CONSTRAINT post_comment_fk
        REFERENCES posts(post_id)
        ON DELETE CASCADE,
    member_id INTEGER NOT NULL
        CONSTRAINT member_comment_fk
        REFERENCES community_members(member_id)
        ON DELETE CASCADE,
    content TEXT NOT NULL,
    comment_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE response_units (
    unit_id SERIAL PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_type TEXT NOT NULL 
        CONSTRAINT unit_type_valid
        CHECK(unit_type IN('Fire', 'Police', 'Medical')),
    organization TEXT NOT NULL,
    personnel_count INTEGER NOT NULL 
        CONSTRAINT unit_personnel_count_gt_zero
        CHECK(personnel_count >= 0),
    location GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE help_requests (
    request_id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL UNIQUE
        CONSTRAINT request_report_fk
        REFERENCES incident_reports(report_id)
        ON DELETE CASCADE,
    unit_id INTEGER NOT NULL
        CONSTRAINT request_unit_fk
        REFERENCES response_units(unit_id)
        ON DELETE SET NULL,
    request_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL 
        CONSTRAINT request_status_valid
        CHECK(status IN ('Pending', 'In Progress', 'Completed')),
    called_911 BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE resources (
    resource_id SERIAL PRIMARY KEY,
    resource_name TEXT NOT NULL,
    resource_type TEXT NOT NULL 
        CONSTRAINT resource_valid_type
        CHECK (
            resource_type IN('Food', 'Water', 'Medical Supplies', 'Shelter', 'Services', 'Other')
        ),
    quantity INTEGER NOT NULL 
        CONSTRAINT resource_quantity_gt_zero
        CHECK(quantity >= 0),
    request_id INTEGER
        CONSTRAINT resource_request_fk
        REFERENCES help_requests(request_id)
        ON DELETE SET NULL,
    member_id INTEGER
        CONSTRAINT resource_member_fk
        REFERENCES community_members(member_id)
        ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens(
    user_id INTEGER NOT NULL
        CONSTRAINT reset_token_user_fk
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    token TEXT NOT NULL
        CONSTRAINT reset_token_unique UNIQUE,  -- SHA-256 hash of the emailed token
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '1 hour',
    PRIMARY KEY (user_id, token)
);

CREATE TABLE districts (
  district_id SERIAL PRIMARY KEY,
  district_name TEXT NOT NULL,
  boundary GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE INDEX report_location_index ON incident_reports USING GIST(location);
CREATE INDEX unit_location_index ON response_units USING gist(location);
CREATE INDEX districts_boundaries_index ON districts USING GIST(boundary);