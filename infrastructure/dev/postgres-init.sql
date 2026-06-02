-- Creates one database per service (each service has its own Prisma schema)
CREATE DATABASE identity_service;
CREATE DATABASE flight_service;
CREATE DATABASE booking_service;
CREATE DATABASE payment_service;
CREATE DATABASE checkin_service;

-- Grant all privileges to the shared user
GRANT ALL PRIVILEGES ON DATABASE identity_service TO aerolink;
GRANT ALL PRIVILEGES ON DATABASE flight_service    TO aerolink;
GRANT ALL PRIVILEGES ON DATABASE booking_service   TO aerolink;
GRANT ALL PRIVILEGES ON DATABASE payment_service   TO aerolink;
GRANT ALL PRIVILEGES ON DATABASE checkin_service   TO aerolink;
