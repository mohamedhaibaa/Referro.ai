# Referro Landing Page — Vercel Deployment

## Prerequisites
- GitHub repo with this code pushed
- Vercel account (free tier works)
- Resend account (free tier: 100 emails/day)
- `getreferro.ai` domain on Cloudflare

## Deploy Step-by-Step

### 1. Push to GitHub
Make sure the `landing/` folder is committed and pushed.

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo
2. Set **Root Directory** to `landing`
3. Deploy

### 3. Add Resend API Key
1. Go to [resend.com](https://resend.com) → create a free account → get your API key
2. In Vercel: **Project Settings** → **Environment Variables**
3. Add: `RESEND_API_KEY` = `re_xxxxxxxxxxxx`
4. Redeploy for the env var to take effect

### 4. Connect Domain
In Vercel: **Project Settings** → **Domains** → add `getreferro.ai`

### 5. Update Cloudflare DNS
In Cloudflare DNS for `getreferro.ai`, set proxy to **DNS only** (gray cloud) and add:

| Type  | Name  | Target                  |
|-------|-------|-------------------------|
| CNAME | @     | cname.vercel-dns.com    |
| CNAME | www   | cname.vercel-dns.com    |

**Important:** Proxy must be OFF (DNS only / gray cloud) for Vercel SSL to work.

### 6. Clean up old Cloudflare Pages (optional)
- Delete the `getreferro` project from Cloudflare Pages dashboard
- Delete the `WAITLIST` KV namespace if no longer needed

## Architecture
```
getreferro.ai (Vercel)
  /                → index.html (static landing page)
  /api/subscribe   → Vercel Serverless Function → Resend API → email notification
```

## How It Works
When someone submits their email on the waitlist form:
1. Frontend POSTs to `/api/subscribe`
2. Serverless function sends a notification email to Referro.ai@gmail.com via Resend
3. User sees a success message
