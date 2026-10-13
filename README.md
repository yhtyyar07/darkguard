# DarkGuard - Advanced VPN Subscription Management Panel

A sophisticated, autonomous VPN subscription management system for regions with heavy internet censorship. DarkGuard aggregates multiple VPN subscription sources (sublinks), manages user subscriptions, automatically refreshes configurations, and syncs with Firebase Firestore.

## 🎯 Key Features

### Core Functionality
- **Multi-Protocol Support**: VLESS, VMESS, Hysteria2, Shadowsocks, Trojan
- **Automatic Subscription Refresh**: CRON-based background jobs to update sublinks and regenerate user subscriptions
- **Firestore Auto-Sync**: Every user update automatically syncs to Firebase Firestore for remote access
- **VPN Client Detection**: Automatically detects VPN apps (Hiddify, v2ray, Clash, etc.) and serves appropriate responses
- **User-Agent Based Response**: Shows fake astronomy page to browsers, real subscription data to VPN clients

### Management Features
- **User Management**: Create, enable/disable, track subscription expiry
- **Sublink Management**: Add multiple subscription sources with automatic parsing
- **Short URL Generation**: Unique 6-character codes (e.g., `df-ah-hy`) for each user
- **One-Click Export/Import**: Complete data migration between instances in seconds
- **Real-Time Logs**: Monitor all system activity and events
- **System Health Dashboard**: CPU, RAM, storage monitoring and status indicators

### Security & Routing
- **JWT Token Authentication**: Secure admin panel access
- **Masked Admin Route**: Hidden admin panel at `/dashboard-darkguard`
- **Decoy Homepage**: Fake astronomy page (`/`) to fool monitoring systems
- **Soft Delete**: Users are marked as deleted, not physically removed

## 📋 Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Next.js 16 (App Router, Client Components) |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL 16 (Alpine) |
| **ORM** | Drizzle ORM |
| **Cloud Sync** | Firebase Firestore SDK |
| **Containerization** | Docker & Docker Compose |
| **UI Components** | Tailwind CSS 4, Lucide React |
| **Authentication** | JWT + bcryptjs |
| **HTTP Client** | Axios |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local development)
- PostgreSQL 16 (or use Docker)
- Firebase Project (optional, for Firestore sync)

### Installation

#### Using Docker (Recommended)

1. Clone and navigate to project directory:
```bash
git clone <repo-url>
cd darkguard
```

2. Create `.env` file from the template and set unique strong credentials:
```env
DB_PASSWORD=long_random_database_password
ADMIN_USERNAME=admin
ADMIN_PASSWORD=long_random_admin_password
JWT_SECRET=at_least_32_random_characters
CRON_SECRET=long_random_cron_secret
FIREBASE_SERVICE_ACCOUNT_KEY=base64_encoded_service_account_json
PORT=3000
```
For optional Firestore sync, create a service-account key in Firebase Console
under Project Settings → Service Accounts. Keep the downloaded JSON private and
never commit it. On the VPS, encode it as one line with `base64 -w 0
service-account.json` and put that output in `FIREBASE_SERVICE_ACCOUNT_KEY`.
The Firebase web API key or app ID is not a server service-account credential.
Generate secrets with `openssl rand -hex 32`. Never commit `.env`.

3. Start with Docker Compose:
```bash
docker compose up -d --build
```

The panel will be available at `http://localhost:3000` and the admin at `http://localhost:3000/dashboard-darkguard`.

#### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up PostgreSQL:
```bash
# Using docker
docker run -d \
  --name darkguard_db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=app_db \
  -p 5432:5432 \
  postgres:16-alpine
```

3. Update `.env` with your database URL

4. Apply database schema:
```bash
npx drizzle-kit push
```

5. Start development server:
```bash
npm run dev
```

## 📊 Dashboard Overview

### Login
- Route: `/dashboard-darkguard`
- Credentials: values configured in `.env`
- Secured with JWT tokens stored in localStorage

### Overview Page
- System status and health indicators
- Key metrics (total users, active users, sublinks, servers)
- Quick action buttons to manage resources

### Users Management
- **Create User**: Add new subscription users with expiry dates
- **View Users**: List all users with status, short URL, request count
- **Status Tracking**: Active, Disabled, Expired states
- **Auto-Generated URLs**: Each user gets a unique short URL (e.g., `df-ah-hy`)

### Sublinks Management
- **Add Sublink**: Import VPN subscription sources
- **Format Detection**: Automatically detects base64, raw, JSON, or text formats
- **Server Parsing**: Extracts and counts available servers
- **Refresh All**: Trigger manual refresh of all sublinks and regenerate user subscriptions
- **Auto-Refresh**: Configurable CRON jobs for automated updates

### Logs
- Real-time activity monitoring
- Categorized logs: sublink_refresh, firestore_sync, user_action, system_error
- Log levels: info, warning, error, success
- Auto-refreshing display (every 10 seconds)

### Data Management
- **Export**: Download complete system data as JSON
- **Import**: Restore data from previous backup
- **Migration**: Move entire setup to new VPS in minutes

### Settings
- **Firebase Configuration**: Update Firestore credentials dynamically
- **System Information**: View version, dependencies, protocol support
- **Supported Protocols**: VLESS, VMESS, Hysteria2, Shadowsocks, Trojan

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin authentication, returns JWT token

### Subscriptions (Public)
- `GET /api/subscriptions/[userId]` - Get user subscription (by ID or short URL)
  - Auto-detects VPN apps via User-Agent
  - Returns base64 subscription or status message

### Admin APIs (Requires JWT)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `GET /api/admin/sublinks` - List all sublinks
- `POST /api/admin/sublinks` - Add new sublink
- `PATCH /api/admin/sublinks` - Refresh all sublinks
- `GET /api/admin/logs` - View system logs
- `DELETE /api/admin/logs` - Clear old logs
- `GET /api/admin/export` - Export all data
- `POST /api/admin/export` - Import data

### Health
- `GET /api/health` - System health check

## 🔄 Subscription Flow

### User Request to Subscription

1. **VPN Client Request**:
   ```
   GET /api/subscriptions/df-ah-hy
   User-Agent: Hiddify-xxx
   ```

2. **Server Processing**:
   - Detects VPN app via User-Agent
   - Checks user status (active/disabled/expired)
   - Returns base64-encoded subscription or status message
   - Updates request count and last-requested timestamp

3. **Response Headers**:
   ```
   Subscription-Userinfo: upload=0; download=0; total=0; expire=1234567890
   Content-Type: text/plain (for VPN apps) | application/json (for browsers)
   ```

### Background Refresh Process

1. **CRON Trigger** (configurable interval):
   - `POST /api/admin/sublinks` with `X-Cron-Secret` header

2. **Sublink Update**:
   - Fetch latest data from each subscription source
   - Parse servers (VLESS, VMESS, etc.)
   - Update serverCount and lastRefreshed timestamp

3. **User Regeneration**:
   - Find all users associated with updated sublinks
   - Combine all enabled servers into single base64
   - Update user.base64Data

4. **Firebase Sync**:
   - For each updated user, sync to Firestore:
     - shortUrl, username, status, base64Data
     - updatedAt, expiryDate, requestCount

5. **Logging**:
   - Record refresh stats (sublinks updated, users affected)
   - Log any errors for debugging

## 🗄️ Database Schema

### Tables

**users**
- id, username, status, expiryDate
- shortUrl (unique 6-char code)
- base64Data (generated subscription)
- sublinkIds (array of associated sublinks)
- requestCount, lastRequested
- firebaseDocId, firebaseSyncedAt

**sublinks**
- id, name, url, format, status
- servers (JSON array)
- serverCount, lastRefreshed
- headers, expireDate, quota info

**logs**
- id, level, category, message
- userId, sublinkId (optional)
- metadata (JSON), createdAt

**settings**
- id, key, value, type, description

**refreshHistory**
- Tracks all sublink refresh events

**cache**
- Temporary data storage with TTL

## 🔐 Security Considerations

### Admin Access
- JWT tokens expire after 24 hours
- Stored in localStorage (client-side)
- Remove token on logout
- HTTPS recommended for production

### Data Protection
- Passwords hashed with bcryptjs
- Database credentials in environment variables
- Firestore service account key secured
- Soft deletes prevent accidental data loss

### User Privacy
- No plain-text passwords stored
- Minimal personal data retention
- Automatic log cleanup (configurable)
- User can view only their own subscription

### API Security
- Bearer token authentication required for admin APIs
- CRON secret validation for background jobs
- Rate limiting recommended (implement at reverse proxy)

## 📱 VPN App Compatibility

Tested with:
- ✅ Hiddify
- ✅ v2rayNG / v2rayN
- ✅ Clash
- ✅ Nekobox
- ✅ Singbox
- ✅ Xray
- ✅ Any client sending standard User-Agent

Detection mechanism uses substring matching in User-Agent header. VPN apps receive base64 subscriptions; browsers receive status page.

## 🚢 Deployment

### Portainer Integration
Docker Compose is fully compatible with Portainer for easy management:

1. Add stack from GitHub/GitLab
2. Paste `docker-compose.yml`
3. Configure environment variables
4. Deploy

### Performance Tips
- Enable Redis for caching (optional)
- Use CDN for static assets
- Set up reverse proxy (Nginx) with SSL
- Enable GZIP compression
- Use PostgreSQL connection pooling

### Scaling
- Horizontal: Deploy multiple instances behind load balancer
- Share PostgreSQL and Firestore (they handle distributed access)
- Use Firestore for session sharing if needed

## 📝 Configuration

### Environment Variables

**Database**
- `DATABASE_URL` - PostgreSQL connection string

**Admin**
- `ADMIN_USERNAME` - Default admin username
- `ADMIN_PASSWORD` - Default admin password
- `JWT_SECRET` - JWT signing secret (minimum 32 chars)

**Firebase** (optional)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Base64-encoded Firebase service-account JSON; required for server-side Firestore writes

**System**
- `CRON_SECRET` - Secret for triggering background jobs
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - production/development

### CRON Setup

Use external service to trigger refresh:

```bash
# Every 6 hours
0 */6 * * * curl -X PATCH https://your-domain/api/admin/sublinks \
  -H "X-Cron-Secret: your_cron_secret" \
  -H "Authorization: Bearer your_token"
```

Or use in-app scheduling (future feature):
- Implement bull/bullmq for job queues
- Store scheduled jobs in database
- Execute at specified intervals

## 📈 Monitoring

### Health Check
```bash
curl https://your-domain/api/health
```

### Logs Analysis
- Check `/dashboard-darkguard/logs` for real-time activity
- Export logs periodically for archival
- Set up log aggregation (e.g., ELK stack)

### Alerts
Set up monitoring for:
- Failed sublink refreshes
- High error rates
- Expired subscriptions
- Database connection issues
- High resource usage

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL
docker logs darkguard_db

# Verify connection string in .env
psql $DATABASE_URL -c "SELECT 1"
```

### Sublink Not Updating
- Check sublink URL is accessible
- Verify subscription format (base64/raw/JSON)
- Check logs for parse errors
- Manually trigger refresh from dashboard

### Firebase Sync Not Working
- Verify Settings reports Firestore as connected
- Set `FIREBASE_SERVICE_ACCOUNT_KEY` to the Base64-encoded service-account JSON in the server `.env`
- Ensure the service account belongs to the intended Firebase project and can write to Firestore
- Ensure network can reach Firebase
- Review Firebase project quota

### Performance Issues
- Check database slow query log
- Monitor server CPU/RAM/disk
- Review Firestore write limits
- Optimize subscription parsing for large servers

## 📚 API Usage Examples

### Get User Subscription (from VPN client)
```bash
curl -H "User-Agent: Hiddify/1.0" \
  https://your-domain/api/subscriptions/df-ah-hy
```

### Create User (from admin panel)
```bash
curl -X POST https://your-domain/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1",
    "expiryDate": "2024-12-31T23:59:59Z",
    "sublinkIds": [1, 2]
  }'
```

### Export Data
```bash
curl https://your-domain/api/admin/export \
  -H "Authorization: Bearer $TOKEN" > backup.json
```

### Trigger Refresh
```bash
curl -X PATCH https://your-domain/api/admin/sublinks \
  -H "X-Cron-Secret: $CRON_SECRET"
```

## 📄 License

MIT License - See LICENSE file for details

## ⚠️ Disclaimer

This tool is designed for bypassing internet censorship in regions where it's necessary for freedom of expression. Users are responsible for compliance with local laws. The developers are not liable for misuse.

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Enhanced UI/UX
- Performance optimizations
- Additional protocol support
- Metrics and analytics
- Mobile app integration
- Advanced filtering options

## 📞 Support

For issues and questions:
1. Check the logs via dashboard
2. Review troubleshooting section
3. Check GitHub issues
4. Contact project maintainers

---

**DarkGuard v1.0** - Secure, autonomous VPN subscription management for censored regions.
"# darkguard" 
