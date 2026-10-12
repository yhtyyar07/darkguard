# DarkGuard Deployment Guide

Complete guide for deploying DarkGuard to production.

## Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Docker & Docker Compose installed
- At least 2GB RAM, 10GB storage
- Public IP or domain name (optional but recommended)
- Firewall configured to allow port 3000 (or your chosen port)

## Step 1: Prepare VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Step 2: Clone Repository

```bash
# Clone repo
cd /opt
sudo git clone <your-repo-url> darkguard
sudo chown -R $USER:$USER darkguard
cd darkguard
```

## Step 3: Configure Environment

```bash
# Create and edit .env; Compose constructs DATABASE_URL from DB_PASSWORD.
cp .env.example .env
chmod 600 .env
```

Set unique values for `DB_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
`JWT_SECRET`, and `CRON_SECRET`. Generate a fresh secret for each value:
```bash
openssl rand -hex 32
```

## Step 4: Start Services

```bash
# Start all services
sudo docker compose up -d --build

# Wait for startup (about 1-2 minutes)
sleep 30

# Check status
sudo docker-compose ps

# View logs
sudo docker-compose logs -f app
```

## Step 5: Initial Setup

1. Open browser to `http://your-server-ip:3000`
2. You should see the DarkGuard homepage with "ACCESS ADMIN PANEL" button
3. Click the button to go to `/dashboard-darkguard`
4. Log in with credentials from `.env`:
   - Username: the `ADMIN_USERNAME` value from `.env`
   - Password: (your chosen password)

## Step 6: Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000/tcp

# Or if using specific ports, update accordingly
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Step 7: Setup Reverse Proxy (Optional but Recommended)

### Using Nginx

```bash
# Install nginx
sudo apt install -y nginx

# Create config
sudo cat > /etc/nginx/sites-available/darkguard << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable config
sudo ln -s /etc/nginx/sites-available/darkguard /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl restart nginx
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Update nginx config to include SSL
# (Certbot can do this automatically)
sudo certbot --nginx -d your-domain.com
```

## Step 8: Setup CRON for Auto-Refresh

Schedule automatic subscription refresh:

```bash
# Edit crontab
crontab -e

# Add this line to refresh every 6 hours
0 */6 * * * curl -X PATCH http://localhost:3000/api/admin/sublinks \
  -H "X-Cron-Secret: your_cron_secret" \
  -H "Content-Type: application/json" \
  2>&1 >> /var/log/darkguard-cron.log
```

Or use cloud-based CRON service:
- EasyCron (https://www.easycron.com)
- SetCronJob (https://www.setcronjob.com)

## Step 9: Setup Backups

```bash
# Create backup script
cat > /opt/darkguard/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/backups/darkguard"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Export database
docker exec darkguard_db pg_dump -U postgres app_db | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Export application data
curl -s http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $(cat /opt/darkguard/.admin_token)" \
  | gzip > $BACKUP_DIR/app_$TIMESTAMP.json.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $TIMESTAMP"
EOF

chmod +x /opt/darkguard/backup.sh

# Schedule daily backup
crontab -e
# Add: 2 0 * * * /opt/darkguard/backup.sh
```

## Step 10: Monitoring Setup

### Container Health Check

```bash
# Check container status
sudo docker compose ps

# View real-time logs
sudo docker compose logs -f app

# Check specific service
sudo docker-compose logs db
```

### System Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop nethogs

# Monitor in real-time
htop
```

### Health Check Endpoint

```bash
# Check API health
curl http://localhost:3000/api/health

# Should return: {"status": "ok"}
```

## Step 11: Manage Sublinks

1. Log into admin panel at `/dashboard-darkguard`
2. Navigate to "Sublinks Management"
3. Add your VPN subscription sources (paste subscription URLs)
4. System will automatically:
   - Parse servers (VLESS, VMESS, etc.)
   - Store configuration
   - Make available to users

## Step 12: Create Users

1. In admin panel, go to "Users"
2. Click "New User"
3. Enter:
   - Username
   - Expiry Date (when subscription expires)
   - Associated Sublinks (optional)
4. Click "Create"
5. Each user gets auto-generated short URL (e.g., `df-ah-hy`)

## Step 13: Share with Users

Users can access their subscription via:

```
http://your-domain:3000/api/subscriptions/{short-url}
```

For example:
```
http://your-domain:3000/api/subscriptions/df-ah-hy
```

Or use in VPN clients:
- Hiddify: Paste URL in subscription list
- v2ray: Add subscription source
- Clash: Add subscription profile

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo docker-compose logs

# If database issue:
sudo docker-compose down
sudo rm -rf postgres_data
sudo docker-compose up -d
```

### High Memory Usage

```bash
# Limit container memory
# Edit docker-compose.yml and add:
# memory: 1g
# memswap_limit: 2g
```

### Database Connection Error

```bash
# Test database connection
docker exec darkguard_db psql -U postgres -d app_db -c "SELECT 1"

# Check db logs
sudo docker-compose logs db
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill it if not needed
sudo kill -9 <PID>

# Or change port in docker-compose.yml and .env
```

## Update Process

```bash
# Pull latest changes
cd /opt/darkguard
git pull origin main

# Rebuild and restart
sudo docker-compose down
sudo docker-compose up -d --build

# Migrations run automatically on start
```

## Production Best Practices

1. **Use HTTPS**
   - Configure SSL certificates with Let's Encrypt
   - Redirect HTTP to HTTPS

2. **Strong Credentials**
   - Use 32+ character passwords
   - Change default admin credentials
   - Use long JWT secrets

3. **Regular Backups**
   - Set up automated daily backups
   - Test restore procedures
   - Store backups off-site

4. **Monitor Logs**
   - Check logs regularly for errors
   - Set up log aggregation
   - Alert on critical errors

5. **Database**
   - Enable PostgreSQL backups
   - Set max_connections appropriately
   - Monitor disk space

6. **Security**
   - Keep system packages updated
   - Run containers as non-root (when possible)
   - Use firewall to restrict access
   - Implement rate limiting at reverse proxy

7. **Performance**
   - Use CDN for static assets
   - Enable caching headers
   - Monitor API response times
   - Optimize database queries

## Scaling for High Load

### Horizontal Scaling

```yaml
# docker-compose.yml - add multiple app instances
services:
  app1:
    # ... config ...
    ports:
      - "3001:3000"
  
  app2:
    # ... config ...
    ports:
      - "3002:3000"
```

Then use load balancer (Nginx, HAProxy) to distribute traffic.

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_expiry ON users(expiry_date);
CREATE INDEX idx_sublinks_status ON sublinks(status);
```

## Data Migration

To migrate from old instance to new:

1. On old instance, export data:
   ```bash
   curl http://old-server/api/admin/export \
     -H "Authorization: Bearer $TOKEN" > backup.json
   ```

2. On new instance, import data:
   ```bash
   curl -X POST http://new-server/api/admin/export \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d @backup.json
   ```

## Support & Maintenance

- Check logs regularly: `sudo docker-compose logs -f`
- Monitor resource usage: `docker stats`
- Update regularly: `git pull && docker-compose up -d --build`
- Keep PostgreSQL updated
- Monitor Firestore quota (if using)

---

For additional help, check the main [README.md](README.md) or troubleshooting guide.
