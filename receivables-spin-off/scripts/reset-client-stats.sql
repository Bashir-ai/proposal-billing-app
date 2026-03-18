-- Reset Client Statistics
-- This script clears all client finder assignments and manager assignments
-- Run this in your PostgreSQL database to reset account stats

-- 1. Delete all ClientFinder records (resets clientsFound count for all users)
DELETE FROM "ClientFinder";

-- 2. Clear all clientManagerId fields (resets clientsManaged count for all users)
UPDATE "Client" SET "clientManagerId" = NULL;

-- Verify the reset
SELECT 
  COUNT(*) as total_client_finders,
  'ClientFinder records remaining' as status
FROM "ClientFinder"
UNION ALL
SELECT 
  COUNT(*) as clients_with_managers,
  'Clients with managers remaining' as status
FROM "Client"
WHERE "clientManagerId" IS NOT NULL;
