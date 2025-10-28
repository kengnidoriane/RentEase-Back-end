-- Create databases if they don't exist
SELECT 'CREATE DATABASE rentease_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rentease_dev')\gexec

SELECT 'CREATE DATABASE rentease_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rentease_test')\gexec

-- Create user if it doesn't exist
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'rentease') THEN

      CREATE ROLE rentease LOGIN PASSWORD 'password';
   END IF;
END
$do$;

-- Grant permissions to the user
GRANT ALL PRIVILEGES ON DATABASE rentease_dev TO rentease;
GRANT ALL PRIVILEGES ON DATABASE rentease_test TO rentease;