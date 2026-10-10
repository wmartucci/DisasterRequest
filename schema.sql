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

CREATE INDEX report_location_index ON incident_reports USING GIST(location);