# Migration Instructions: Add RECURRING to ProposalType Enum

The database needs to be updated to include the new `RECURRING` value in the `ProposalType` enum.

## Option 1: Using Prisma DB Push (Recommended)

Run this command in your terminal:

```bash
npx prisma db push
```

This will update your database schema to match your Prisma schema.

## Option 2: Manual SQL Execution

If `prisma db push` doesn't work, you can run the SQL script directly:

1. Connect to your PostgreSQL database
2. Run the SQL script: `prisma/add_recurring_enum.sql`

Or run it directly with psql:

```bash
psql -d your_database_name -f prisma/add_recurring_enum.sql
```

## Option 3: Using Prisma Migrate

If you prefer to use migrations:

```bash
npx prisma migrate dev --name add_recurring_proposal_type
```

## After Migration

After updating the database, regenerate the Prisma client:

```bash
npx prisma generate
```

Then restart your development server.
