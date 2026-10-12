# DarkGuard Quick Start Guide

Get DarkGuard running in 5 minutes.

## Prerequisites

- Docker & Docker Compose installed
- Or: Node.js 22+, PostgreSQL 16

## Option 1: Docker (Easiest)

### 1. Clone & Setup

```bash
git clone <repo-url>
cd darkguard

# Create .env file
cp .env.example .env
```

Edit `.env` and set unique strong values for `DB_PASSWORD`, `ADMIN_USERNAME`,
`ADMIN_PASSWORD`, `JWT_SECRET`, and `CRON_SECRET`. Generate each secret on the VPS
with `openssl rand -hex 32`. Keep `.env` private and never commit it.

### 2. Start

```bash
docker compose up -d --build

# Wait ~30 seconds for startup
sleep 30

# Check status
docker compose ps
```

### 3. Access

- **Homepage**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/dashboard-darkguard
- **Login**: the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values from `.env`

## Option 2: Local Development

### 1. Setup Database

```bash
# Option A: Docker
docker run -d \
  --name darkguard_db \
  -e POSTGRES_PASSWORD=replace_with_your_local_password \
  -e POSTGRES_DB=app_db \
  -p 127.0.0.1:5432:5432 \
  postgres:16-alpine

# Option B: Use your PostgreSQL
# Make sure app_db database exists
```

For local development, add `DATABASE_URL` to `.env`, for example:
`DATABASE_URL=postgresql://postgres:your_local_password@127.0.0.1:5432/app_db`.
The Docker Compose deployment supplies its own internal `DATABASE_URL`.

### 2. Install & Run

```bash
npm install
npx drizzle-kit push  # Apply schema
npm run dev
```

The first install requires access to the npm registry. On a VPS, make sure DNS
and outbound HTTPS access to `registry.npmjs.org` are available before building.

### 3. Access

- App: http://localhost:3000
- Admin: http://localhost:3000/dashboard-darkguard

## First Steps in Admin Panel

### 1. Add Subscription Source (Sublink)

1. Go to "Sublinks" tab
2. Click "Add Sublink"
3. Enter:
   - **Name**: MyVPN
   - **URL**: `https://your-subscription-url.com/sub`
4. Click "Add"
5. System will parse and display server count

### 2. Create User

1. Go to "Users" tab
2. Click "New User"
3. Enter:
   - **Username**: testuser
   - **Expiry Date**: 2025-12-31
   - **Sublinks**: Select the sublink you added
4. Click "Create"
5. Note the short URL (e.g., `df-ah-hy`)

### 3. Test Subscription

```bash
# Get subscription as base64
curl http://localhost:3000/api/subscriptions/df-ah-hy \
  -H "User-Agent: Hiddify"

# Should return base64 string of VPN configs
```

## Adding to VPN Clients

### Hiddify

1. Open Hiddify
2. Add Subscription
3. Paste: `http://your-server:3000/api/subscriptions/df-ah-hy`
4. Click OK
5. Tap refresh to load servers

### v2rayNG

1. Open v2rayNG
2. Menu → Add subscription
3. URL: `http://your-server:3000/api/subscriptions/df-ah-hy`
4. Remarks: MyVPN
5. Save

### Clash

1. Profiles → Create
2. Name: DarkGuard
3. Subscription URL: `http://your-server:3000/api/subscriptions/df-ah-hy`
4. Update

## Common Tasks

### Refresh All Subscriptions

```bash
# From admin panel: Sublinks → Refresh All
# Or via API:
curl -X PATCH http://localhost:3000/api/admin/sublinks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Cron-Secret: value-of-CRON_SECRET-from-.env"
```

### Export Data (Backup)

1. Go to "Data" tab
2. Click "Export Now"
3. Save JSON file

### Import Data (Restore)

1. Go to "Data" tab
2. Click "Choose File"
3. Select previously exported JSON
4. Wait for import to complete

### Disable User

1. Go to "Users" tab
2. Select user
3. Click "Edit" (pencil icon)
4. Change status to "disabled"
5. Save

### View Logs

1. Go to "Logs" tab
2. See real-time system activity
3. Click refresh for latest

## Monitoring

### Check Container Status

```bash
docker-compose ps
```

### View Logs

```bash
docker-compose logs -f app
```

### Check Database Connection

```bash
curl http://localhost:3000/api/health
# Should return: {"ok":true}
```

## Default Ports

- **App**: 3000
- **Database**: 5432 (PostgreSQL)

## Change Admin Password

### In .env (before starting)

```env
ADMIN_PASSWORD=your_new_password
```

### In Running Container

1. Update `.env`
2. Restart: `docker-compose restart app`

## Reset Everything

```bash
# Stop all containers
docker-compose down

# Remove data volumes (caution: deletes database!)
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Troubleshooting

### Can't Access Admin Panel

1. Check containers: `docker-compose ps`
2. Check logs: `docker-compose logs app`
3. Try http://localhost:3000 first
4. Verify firewall allows port 3000

### Database Connection Error

```bash
# Check if db container is running
docker-compose logs db

# Restart database
docker-compose restart db
```

### Sublink Not Updating

1. Check URL is accessible: `curl https://your-subscription-url`
2. Check format is supported (base64, raw, JSON)
3. Look in "Logs" tab for errors
4. Try manual refresh from Sublinks page

### Forget Admin Password

```bash
# Reset to default
cat >> .env << 'EOF'
ADMIN_PASSWORD=newpassword
EOF

docker-compose restart app
```

## Next Steps

1. **Add multiple sublinks** for better reliability
2. **Create multiple users** for different people
3. **Set up CRON** for automatic refresh
4. **Configure backups** for data safety
5. **Deploy to production** using DEPLOYMENT.md guide
6. **Setup SSL/HTTPS** for security
7. **Configure Firewall** to restrict access
8. **Monitor regularly** via dashboard logs

## Getting Help

- Check logs: `docker-compose logs -f`
- Review README.md for detailed documentation
- Check DEPLOYMENT.md for production setup
- Look in dashboard Logs tab for system messages

---

**Welcome to DarkGuard!** 🚀

For detailed configuration, see [README.md](README.md)
For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md)
