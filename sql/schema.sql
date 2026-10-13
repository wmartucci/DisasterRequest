CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE community_members (
    member_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    tel_no TEXT NOT NULL 
        CONSTRAINT member_valid_tel_no 
        CHECK (
            tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
        )
);

CREATE TABLE response_coordinators (
    coordinator_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tel_no TEXT NOT NULL 
        CONSTRAINT coordinator_valid_tel_no 
        CHECK (
            tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
        ),
    email TEXT NOT NULL 
        CONSTRAINT coordinator_valid_email 
        CHECK (
            email LIKE '_%@_%._%'
        )
);

CREATE TABLE incident_reports (
    report_id SERIAL PRIMARY KEY,
    coordinator_id INTEGER 
        CONSTRAINT report_cooordinator_fk
        REFERENCES response_coordinators(coordinator_id)
        ON DELETE SET NULL,
    member_id INTEGER NOT NULL 
        CONSTRAINT report_member_fk
        REFERENCES community_members(member_id)
        ON DELETE RESTRICT,
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
    member_id INTEGER 
        CONSTRAINT posts_members_fk
        REFERENCES community_members(member_id)
        ON DELETE CASCADE,
    post_title VARCHAR(50) NOT NULL,
    post_content VARCHAR(3000) NOT NULL,
    post_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    media VARCHAR(70)
);

CREATE TABLE response_unit (
    unit_id SERIAL PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_type TEXT NOT NULL 
        CONSTRAINT unit_type_valid
        CHECK(unit_type IN('Fire', 'Police', 'Medical')),
    tel_no TEXT NOT NULL 
        CONSTRAINT unit_tel_no_valid
        CHECK (
            tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
        ),
    organization TEXT NOT NULL,
    personnel_count INTEGER NOT NULL 
        CONSTRAINT unit_personnel_count_gt_zero
        CHECK(personnel_count >= 0),
    location GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE help_requests (
    request_id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL
        CONSTRAINT request_report_fk
        REFERENCES incident_reports(report_id)
        ON DELETE CASCADE,
    unit_id INTEGER NOT NULL
        CONSTRAINT request_unit_fk
        REFERENCES response_unit(unit_id)
        ON DELETE SET NULL,
    request_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL 
        CONSTRAINT request_status_valid
        CHECK(status IN ('Pending', 'In Progress', 'Completed')),
    called_911 BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE volunteers (
    volunteer_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tel_no TEXT NOT NULL 
        CONSTRAINT volunteer_valid_tel_no
        CHECK (
            tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
        ),
    email TEXT NOT NULL 
        CONSTRAINT volunteer_valid_email
        CHECK (
            email LIKE '_%@_%._%'
        )
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
    volunteer_id INTEGER 
        CONSTRAINT resource_volunteer_fk
        REFERENCES volunteers(volunteer_id)
        ON DELETE SET NULL
);

CREATE INDEX report_location_index ON incident_reports USING GIST(location);