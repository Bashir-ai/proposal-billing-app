# Quick Staging Setup Guide

## Fastest Way to Deploy (Vercel - ~5 minutes)

### Step 1: Prepare Your Code
```bash
# Make sure everything is committed
git status

# If not already a git repo:
git init
git add .
git commit -m "Ready for staging deployment"
```

### Step 2: Push to GitHub
1. Create a new repository on GitHub
2. Push your code:
```bash
git remote add origin https://github.com/yourusername/your-repo.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your repository
4. Vercel will auto-detect Next.js - click "Deploy"

### Step 4: Set Up Database
**Option A: Use Railway PostgreSQL (Free)**
1. Go to [railway.app](https://railway.app)
2. Create new project → Add PostgreSQL
3. Copy the connection string

**Option B: Use Supabase (Free)**
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy the connection string (use "Connection string" → "URI")

**Option C: Use your existing PostgreSQL**
- Use your current `DATABASE_URL`

### Step 5: Configure Environment Variables in Vercel
1. Go to your project in Vercel
2. Settings → Environment Variables
3. Add these variables:

```
DATABASE_URL = "your-postgresql-connection-string"
NEXTAUTH_SECRET = "generate-with-openssl-rand-base64-32"
NEXTAUTH_URL = "https://your-app.vercel.app"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 6: Run Database Migrations
1. In Vercel, go to your deployment
2. Go to "Deployments" tab
3. Click the three dots on latest deployment → "Redeploy"
4. Or add a build command in Vercel settings:
   - Build Command: `npx prisma generate && npm run build`
   - Or manually run: `npx prisma db push` after deployment

### Step 7: Create Test Users
1. Log in to your deployed app as admin
2. Go to: `https://your-app.vercel.app/admin/create-test-users`
3. Click "Create Test Users"

### Step 8: Share with Collaborators
Share:
- URL: `https://your-app.vercel.app`
- Test user credentials (from the test users page)

## Alternative: Railway (All-in-One)

1. Sign up at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add PostgreSQL database (Railway provides DATABASE_URL automatically)
4. Set environment variables:
   - `NEXTAUTH_SECRET` (generate with openssl)
   - `NEXTAUTH_URL` (your Railway URL)
5. Add build command: `npx prisma generate && npm run build`
6. Deploy!

## Testing Checklist

After deployment, test:
- [ ] Can access the login page
- [ ] Can log in with test credentials
- [ ] Can view dashboard
- [ ] Can create a proposal
- [ ] Can view proposals
- [ ] Can create clients
- [ ] Database persists data

## Common Issues

**"Database connection failed"**
- Check DATABASE_URL is correct
- Verify database allows external connections
- Check firewall settings

**"NEXTAUTH_SECRET is missing"**
- Make sure it's set in environment variables
- Redeploy after adding it

**"Build fails"**
- Check build logs in Vercel/Railway
- Ensure all dependencies are in package.json
- Try `npm install` locally first

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Prisma Deployment: https://www.prisma.io/docs/guides/deployment


