-- Add RECURRING to ProposalType enum
-- Run this SQL script against your database to add the RECURRING value to the ProposalType enum
-- 
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE in all versions.
-- If you get an error that the value already exists, you can ignore it.

-- For PostgreSQL 9.1+
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'RECURRING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProposalType')
    ) THEN
        ALTER TYPE "ProposalType" ADD VALUE 'RECURRING';
    END IF;
END $$;

