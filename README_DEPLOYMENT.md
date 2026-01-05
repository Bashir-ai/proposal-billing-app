# 🚀 Quick Deployment Guide

## Fastest Path to Deploy (5-10 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Deploy to Vercel (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub
2. **Click "Add New Project"** → Import your repository
3. **Vercel auto-detects Next.js** → Click "Deploy"
4. **Set Environment Variables** (in Vercel dashboard):
   ```
   DATABASE_URL = "your-postgresql-connection-string"
   NEXTAUTH_SECRET = "generate-with: openssl rand -base64 32"
   NEXTAUTH_URL = "https://your-app.vercel.app"
   ```
5. **Redeploy** after adding environment variables

### 3. Set Up Database

**Free PostgreSQL Options:**
- **Railway**: [railway.app](https://railway.app) → New Project → Add PostgreSQL
- **Supabase**: [supabase.com](https://supabase.com) → New Project → Database settings
- **Neon**: [neon.tech](https://neon.tech) → Free tier available

**After getting DATABASE_URL:**
- Add it to Vercel environment variables
- Run: `npx prisma db push` (or use Vercel's deployment)

### 4. Create Test Users

1. Log in as admin to your deployed app
2. Go to: `https://your-app.vercel.app/admin/create-test-users`
3. Click "Create Test Users"

### 5. Share with Collaborators

Share:
- **URL**: `https://your-app.vercel.app`
- **Test credentials**: See the test users page

---

## Alternative: Railway (All-in-One)

1. Sign up at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add PostgreSQL database (automatic DATABASE_URL)
4. Set environment variables:
   - `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (your Railway URL)
5. Deploy!

---

## Environment Variables Needed

```env
DATABASE_URL="postgresql://user:password@host:port/database"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-deployment-url.com"
```

---

## Need More Details?

See `DEPLOYMENT.md` for comprehensive guide or `STAGING_SETUP.md` for step-by-step instructions.




