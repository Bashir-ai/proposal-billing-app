# Quick Fix for Upfront Invoice Error

## The Problem
You're seeing: "Database schema mismatch. The database needs to be updated."

## The Solution (3 Simple Steps)

### Step 1: Stop Your Server
Press `Ctrl+C` in the terminal where `npm run dev` is running.

### Step 2: Run This Command
```bash
npm run db:migrate-upfront
```

This will:
- Update your database with the new fields
- Regenerate the Prisma client

**If it asks about resetting the database, answer "N" (No)**

### Step 3: Restart Your Server
```bash
npm run dev
```

### Step 4: Try Again
Go back to your proposal and try generating the upfront invoice again.

---

## Alternative: Manual Steps

If the script doesn't work, run these commands one by one:

```bash
npx prisma db push
npx prisma generate
npm run dev
```

---

## What Fields Are Being Added?

**Bill table:**
- `isUpfrontPayment` (Boolean)
- `creditApplied` (Float)
- `relatedInvoiceId` (String, optional)

**BillItem table:**
- `isCredit` (Boolean)

---

## Still Having Issues?

1. Make sure your `.env` file has `DATABASE_URL` set correctly
2. Make sure your database is running
3. Check the terminal output for any error messages
4. Try clearing the Next.js cache: `rm -rf .next && npm run dev`





