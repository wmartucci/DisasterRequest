CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS community_members (
    member_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    tel_no TEXT NOT NULL CHECK (
        tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
    )
);

CREATE TABLE IF NOT EXISTS response_coordinators (
    coordinator_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tel_no TEXT NOT NULL CHECK (
        tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
    ),
    email TEXT NOT NULL CHECK (
        email LIKE '_%@_%._%'
    )
);

CREATE TABLE IF NOT EXISTS incident_reports (
    report_id SERIAL PRIMARY KEY,
    coordinator_id INTEGER REFERENCES response_coordinators(coordinator_id),
    member_id INTEGER NOT NULL REFERENCES community_members(member_id),
    type TEXT NOT NULL CHECK(type IN('Fallen Tree', 'Flood', 'Fire', 'Power')),
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    report_date DATE NOT NULL CHECK (report_date >= '2020-01-01'),
    report_time TIME NOT NULL,
    image_url TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending Assistance', 'Help Requested', 'Unit in Response', 'Resolved')),
    location GEOMETRY(POINT, 4326)
);

--danijelp--
CREATE TABLE IF NOT EXISTS posts (
    post_id SERIAL PRIMARY KEY,
    post_title VARCHAR(50) NOT NULL,
    post_content VARCHAR(3000) NOT NULL,
    media VARCHAR(70),
    post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    member_id INTEGER REFERENCES community_members(member_id)
    );

--danijelp--
CREATE TABLE IF NOT EXISTS response_unit (
    unit_id SERIAL PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK(unit_type IN('Fire', 'Police', 'Medical')),
    tel_no TEXT NOT NULL CHECK (
        tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
    ),
    organization TEXT NOT NULL,
    personenel_count INTEGER NOT NULL CHECK(personnel_count >= 0)
)

--danijelp--
CREATE TABLE IF NOT EXISTS help_requests (
    request_id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES incident_reports(report_id),
    unit_id INTEGER REFERENCES response_unit(unit_id),
    request_date DATE NOT NULL CHECK (request_date >= '2020-01-01'),
    request_time TIME NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending', 'In Progress', 'Completed')),
    911_called BOOLEAN NOT NULL
)

--danijelp--
CREATE TABLE IF NOT EXISTS volunteers (
    volunteer_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tel_no TEXT NOT NULL CHECK (
        tel_no ~ '^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$'
    ),
    email TEXT NOT NULL CHECK (
        email LIKE '_%@_%._%'
    )
)

--danijelp--
CREATE TABLE IF NOT EXISTS resources (
    resource_id SERIAL PRIMARY KEY,
    resource_name TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN('Food', 'Water', 'Medical Supplies', 'Shelter', 'Services', 'Other')),
    quantity INTEGER NOT NULL CHECK(quantity >= 0)
    volunteer_id INTEGER REFERENCES volunteers(volunteer_id)
)

CREATE INDEX report_location_index ON incident_reports USING GIST(location);