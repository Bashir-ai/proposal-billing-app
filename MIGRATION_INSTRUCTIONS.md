# Database Migration Instructions

## Problem
The upfront payment invoice feature requires new database fields that haven't been added yet.

## Solution
Follow these steps **in order**:

### Step 1: Stop Your Development Server
If your development server is running, stop it by pressing `Ctrl+C` in the terminal where it's running.

### Step 2: Run the Database Migration
Open a terminal in your project directory and run:

```bash
cd "/Users/Bashir1/Desktop/App VPA Simplificada"
npx prisma db push
```

**What to expect:**
- You may see a prompt asking if you want to reset the database
- **Answer "N" (No)** to preserve your existing data
- The command will add the new fields to your database
- You should see a success message like "Your database is now in sync with your schema"

### Step 3: Regenerate Prisma Client (if needed)
Sometimes you need to explicitly regenerate the Prisma client:

```bash
npx prisma generate
```

### Step 4: Restart Your Development Server
Start your development server again:

```bash
npm run dev
```

### Step 5: Try Again
After the server starts, try generating the upfront payment invoice again.

## Fields Being Added

The migration will add these fields:

**To the `Bill` table:**
- `isUpfrontPayment` (Boolean, default: false)
- `creditApplied` (Float, default: 0)
- `relatedInvoiceId` (String, nullable)

**To the `BillItem` table:**
- `isCredit` (Boolean, default: false)

## Troubleshooting

If you still get errors after following these steps:

1. **Check if the migration ran successfully:**
   - Look for a success message in the terminal
   - Check your database to see if the fields exist

2. **Verify your Prisma client is up to date:**
   - Run `npx prisma generate` again
   - Make sure you restarted the dev server after generating

3. **Check your database connection:**
   - Make sure your `.env` file has the correct `DATABASE_URL`
   - Verify your database is running and accessible

4. **Clear Next.js cache (if needed):**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Need Help?

If you're still having issues, check:
- The terminal output from `npx prisma db push` for any error messages
- Your database logs for connection issues
- Make sure you have the correct permissions to modify the database



