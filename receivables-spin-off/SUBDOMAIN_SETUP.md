# Subdomain Setup Guide: vpa.billlex.com

Quick reference guide for configuring the app to run on `vpa.billlex.com` subdomain.

## Prerequisites

- Domain `billlex.com` registered with a domain provider
- Vercel account with the project deployed
- Access to domain DNS management

## Step-by-Step Instructions

### Step 1: Configure DNS Record

**At your domain provider** (where `billlex.com` is registered):

1. Log in to your domain registrar/DNS provider
2. Navigate to DNS Management (may be called "DNS Settings", "DNS Records", or "Advanced DNS")
3. **Add a CNAME record:**
   - **Type:** CNAME
   - **Name/Host:** `vpa` (just the subdomain part, not `vpa.billlex.com`)
   - **Value/Target/Points to:** `cname.vercel-dns.com`
   - **TTL:** 3600 (or use default/automatic)

**Example CNAME record:**
```
Name: vpa
Type: CNAME
Value: cname.vercel-dns.com
TTL: 3600
```

**Common DNS Provider Locations:**
- **GoDaddy:** My Products → Domains → DNS → Add CNAME
- **Namecheap:** Domain List → Manage → Advanced DNS → Add CNAME
- **Cloudflare:** Select domain → DNS → Records → Add CNAME
- **Google Domains:** DNS → Custom resource records → Add CNAME

**Note:** DNS propagation can take 24-48 hours, but often completes within minutes to hours.

### Step 2: Add Domain in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Select your project (proposal-billing-app or similar)
3. Go to **Settings** → **Domains**
4. Click **"Add"** or **"Add Domain"**
5. Enter: `vpa.billlex.com`
6. Click **"Add"**
7. **Wait for verification:** Vercel will check DNS records (green checkmark means success)
8. **SSL Certificate:** Vercel automatically provisions HTTPS - wait 5-10 minutes

### Step 3: Update Environment Variable

**Critical step for authentication to work:**

1. In Vercel dashboard → **Settings** → **Environment Variables**
2. Find `NEXTAUTH_URL` in the list
3. Click **Edit** or update the value to: `https://vpa.billlex.com`
   - **Important:** Must include `https://` prefix
4. Select environments: **Production**, **Preview**, and **Development**
5. Click **Save**

### Step 4: Redeploy Application

After updating `NEXTAUTH_URL`, you **must** trigger a new deployment:

**Option A - Redeploy (Faster):**
1. Go to **Deployments** tab in Vercel
2. Click the **three dots** (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

**Option B - Push a commit:**
```bash
# Make any small change or just push
git commit --allow-empty -m "Update NEXTAUTH_URL for subdomain"
git push origin main
```

### Step 5: Verify Everything Works

1. **Check domain is live:**
   - Visit `https://vpa.billlex.com`
   - Should load your application

2. **Verify SSL certificate:**
   - Check for padlock icon in browser address bar
   - URL should show `https://` (not `http://`)

3. **Test authentication:**
   - Try logging in
   - Authentication should work correctly with new domain

4. **Test API routes:**
   - Try accessing any API endpoint to ensure they work

## Troubleshooting

### DNS Not Resolving

**Check DNS propagation:**
```bash
# On Mac/Linux
dig vpa.billlex.com

# Or
nslookup vpa.billlex.com
```

Should show `CNAME cname.vercel-dns.com`

**If not working:**
- Double-check CNAME record is correct
- Wait longer for DNS propagation (can take 24-48 hours)
- Ensure you entered `vpa` (not `vpa.billlex.com`) as the name

### Domain Verification Failing in Vercel

- **Check DNS:** Use `dig` or `nslookup` to verify CNAME is correct
- **Wait:** DNS propagation can take time
- **Remove and re-add:** Try removing the domain in Vercel and adding it again after DNS is verified

### SSL Certificate Issues

- Wait 5-10 minutes after domain verification
- Vercel automatically provisions SSL - no manual action needed
- If SSL fails after waiting, remove and re-add the domain in Vercel

### Authentication Not Working After Setup

- **Check `NEXTAUTH_URL`:** Must be exactly `https://vpa.billlex.com` (with `https://`)
- **Redeploy:** Must redeploy after updating environment variable
- **Clear cookies:** Clear browser cookies for the domain and try again
- **Check logs:** Check Vercel deployment logs for NextAuth errors

## Current Status Checklist

- [ ] DNS CNAME record added at domain provider
- [ ] Domain added in Vercel dashboard
- [ ] Domain verified (green checkmark in Vercel)
- [ ] `NEXTAUTH_URL` updated to `https://vpa.billlex.com`
- [ ] Application redeployed after environment variable update
- [ ] SSL certificate active (padlock icon visible)
- [ ] App loads at `https://vpa.billlex.com`
- [ ] Login/authentication works
- [ ] API routes are accessible

## Notes

- **Multiple domains:** You can keep both `your-app.vercel.app` and `vpa.billlex.com` working simultaneously
- **Primary domain:** If `vpa.billlex.com` is your primary domain, make sure `NEXTAUTH_URL` matches it
- **DNS propagation:** First-time DNS changes can take up to 48 hours, but often work within minutes
- **No code changes needed:** This is purely infrastructure configuration - no code modifications required

## Support

If issues persist after following all steps:
1. Check Vercel deployment logs for errors
2. Verify DNS records are correct using `dig` or `nslookup`
3. Ensure `NEXTAUTH_URL` environment variable is correctly set and app is redeployed
4. Contact Vercel support if domain verification continues to fail
