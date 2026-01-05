# Deployment Guide - Testing/Staging Version

This guide will help you deploy a testing version of the application that you can share with collaborators.

## Prerequisites

- A GitHub account (recommended for easy deployment)
- A PostgreSQL database (can be hosted or local)
- Environment variables configured

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

**Pros:**
- Free tier available
- Excellent Next.js support
- Automatic deployments from GitHub
- Built-in SSL certificates
- Easy environment variable management

**Steps:**

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Sign up/Login to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub account

3. **Import your project:**
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

4. **Configure Environment Variables:**
   In Vercel dashboard → Project Settings → Environment Variables, add:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

5. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-app.vercel.app`

6. **Set up Database:**
   - Run migrations: `npx prisma migrate deploy` (or use Vercel's build command)
   - Or use `npx prisma db push` for development

### Option 2: Railway

**Pros:**
- Includes PostgreSQL database
- Simple deployment
- Good for full-stack apps

**Steps:**

1. **Sign up at [railway.app](https://railway.app)**

2. **Create a new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"

3. **Add PostgreSQL database:**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will provide `DATABASE_URL` automatically

4. **Configure environment variables:**
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your Railway deployment URL

5. **Deploy:**
   - Railway will automatically build and deploy
   - Run migrations: Add build command: `npx prisma generate && npx prisma migrate deploy`

### Option 3: Render

**Pros:**
- Free tier available
- PostgreSQL included
- Simple setup

**Steps:**

1. **Sign up at [render.com](https://render.com)**

2. **Create PostgreSQL database:**
   - New → PostgreSQL
   - Note the connection string

3. **Create Web Service:**
   - New → Web Service
   - Connect your GitHub repo
   - Build command: `npm install && npx prisma generate && npm run build`
   - Start command: `npm start`

4. **Set environment variables:**
   - `DATABASE_URL` - From PostgreSQL service
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your Render URL

## Environment Variables Required

Create a `.env.production` or set these in your hosting platform:

```env
DATABASE_URL="postgresql://user:password@host:port/database"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://your-deployment-url.com"
```

## Database Setup for Staging

1. **Create a separate staging database** (recommended):
   - Use a different database name (e.g., `proposal_billing_staging`)
   - This keeps test data separate from production

2. **Run migrations:**
   ```bash
   npx prisma migrate deploy
   ```
   Or for development:
   ```bash
   npx prisma db push
   ```

3. **Seed test data** (optional):
   - Create test users via the admin panel
   - Or use the `/admin/create-test-users` page

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] Database migrations have run successfully
- [ ] Test user accounts are created
- [ ] SSL certificate is active (HTTPS)
- [ ] Can log in with test credentials
- [ ] Can create proposals
- [ ] Can view proposals
- [ ] Database connection is stable

## Sharing with Collaborators

1. **Create test user accounts:**
   - Use the `/admin/create-test-users` page
   - Or create accounts manually via registration

2. **Share credentials:**
   - Provide the deployment URL
   - Share test user credentials
   - Document any known issues or limitations

3. **Collect feedback:**
   - Set up a feedback mechanism (Google Form, GitHub Issues, etc.)
   - Monitor error logs in your hosting platform

## Security Considerations for Testing

- Use a separate database for staging
- Don't use production credentials
- Consider IP restrictions if needed
- Regularly rotate test user passwords
- Monitor for abuse

## Troubleshooting

**Build fails:**
- Check environment variables are set
- Verify `DATABASE_URL` is accessible
- Check build logs for specific errors

**Database connection errors:**
- Verify `DATABASE_URL` format is correct
- Check database allows connections from hosting IP
- Ensure database is running

**Authentication issues:**
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your deployment URL
- Clear browser cookies and try again

## Quick Deploy Commands

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build for production
npm run build

# Test production build locally
npm start
```




