# Local Development Setup

## Prerequisites

- **Node.js 18+** (check: `node --version`)
- **npm** (comes with Node.js)
- **Docker Desktop** (for local database - optional if using Supabase cloud)

---

## Quick Start (Using Cloud Supabase)

### 1. Clone the Repository

```bash
git clone https://github.com/vinaykumarvk/report-generator.git
cd report-generator
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Create `.env.local` File

Create a file named `.env.local` in the project root:

```bash
# Service Mode
SERVICE_MODE=web

# Supabase (use your production credentials)
NEXT_PUBLIC_SUPABASE_URL=https://yihuqlzbhaptqjcgcpmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaHVxbHpiaGFwdHFqY2djcG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3OTY4MTUsImV4cCI6MjA3NzM3MjgxNX0.zhEbBZ8-WBd517xzEgtqc9eGNrKO5hmRX7vR0Wu_k6Q
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaHVxbHpiaGFwdHFqY2djcG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc5NjgxNSwiZXhwIjoyMDc3MzcyODE1fQ.O1koKqByyl2L8F1zAfJPOg7hH2rMPVB1jhC3N4Iq-fg
SUPABASE_URL=https://yihuqlzbhaptqjcgcpmh.supabase.co

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_WRITE_MODEL=gpt-4o
OPENAI_REVIEW_MODEL=gpt-4o-mini
OPENAI_VERIFY_MODEL=gpt-4o-mini

# Workspace
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4

# Job Trigger (optional - defaults to db polling)
JOB_TRIGGER_MODE=db
```

**Note:** Replace `your-openai-api-key-here` with your actual OpenAI API key.

---

### 4. Run the Web Server

```bash
npm run dev
```

The app will start at: **http://localhost:3000**

---

### 5. Run the Worker (In a Separate Terminal)

Open a new terminal window:

```bash
cd report-generator
SERVICE_MODE=worker npm run dev
```

Or use the dedicated worker script:

```bash
npm run worker
```

---

## Full Local Setup (With Local Database)

If you want to run everything locally including the database:

### 1. Start Docker Services

```bash
docker compose up -d
```

This starts:
- PostgreSQL with pgvector
- Redis
- MinIO (S3-compatible storage)

---

### 2. Set Up Local Supabase

You'll need to set up a local Supabase instance or use Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase
supabase init

# Start local Supabase
supabase start
```

This will give you local credentials to use in `.env.local`.

---

### 3. Apply Database Schema

If using local database, you'll need to apply the schema. Check the `supabase/migrations/` folder or import from your production Supabase.

---

## Development Workflow

### Run Web + Worker Together

**Terminal 1 (Web):**
```bash
npm run dev
```

**Terminal 2 (Worker):**
```bash
SERVICE_MODE=worker npm run dev
```

---

### With HTTP Trigger Mode (Faster)

**Terminal 1 (Worker with HTTP endpoint):**
```bash
SERVICE_MODE=worker \
WORKER_TRIGGER_SECRET=local-dev-secret \
npm run dev
```

**Terminal 2 (Web with HTTP trigger):**
```bash
SERVICE_MODE=web \
JOB_TRIGGER_MODE=http \
WORKER_TRIGGER_URL=http://localhost:8080/process-job \
WORKER_TRIGGER_SECRET=local-dev-secret \
npm run dev
```

Now jobs will trigger instantly via HTTP!

---

## Available Scripts

```bash
# Development
npm run dev          # Start Next.js dev server
npm run worker       # Start worker process

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run typecheck    # TypeScript type checking
npm run test         # Run tests
```

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbG...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `DEFAULT_WORKSPACE_ID` | Workspace UUID | `abc-123-def` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_MODE` | `web` | `web` or `worker` |
| `JOB_TRIGGER_MODE` | `db` | `db`, `http`, or `cloud-tasks` |
| `WORKER_TRIGGER_URL` | - | Worker HTTP endpoint |
| `WORKER_TRIGGER_SECRET` | - | Shared secret for triggers |
| `PORT` | `3000` (web) / `8080` (worker) | Server port |

---

## Troubleshooting

### Port Already in Use

If port 3000 is taken:

```bash
PORT=3001 npm run dev
```

---

### Worker Not Processing Jobs

1. Check worker is running: `ps aux | grep worker`
2. Check logs in terminal
3. Verify Supabase credentials
4. Check database connection

---

### Database Connection Issues

1. Verify Supabase URL and keys in `.env.local`
2. Check network connection
3. Try accessing Supabase dashboard: https://supabase.com/dashboard

---

### OpenAI API Errors

1. Verify API key is valid
2. Check OpenAI account has credits
3. Verify model names are correct

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

---

## Building for Production

```bash
# Build
npm run build

# Start production server
npm start
```

---

## Docker Compose Services

If using `docker-compose.yml`:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v
```

**Services:**
- **db**: PostgreSQL on port 5432
- **redis**: Redis on port 6379
- **storage**: MinIO on port 9000

---

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

### Format on Save

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## Common Development Tasks

### Create a Test Report

1. Go to http://localhost:3000
2. Navigate to "Templates"
3. Create or select a template
4. Click "Generate Report"
5. Watch worker logs to see processing

---

### View Database

Use Supabase Dashboard:
- Cloud: https://supabase.com/dashboard
- Local: http://localhost:54323

---

### Check Job Status

```bash
# In worker terminal, you'll see:
✅ Claimed job: <id> (START_RUN)
✅ Job processed: <id>
```

---

## Production vs Development

| Feature | Development | Production |
|---------|-------------|------------|
| **Hot Reload** | ✅ Yes | ❌ No |
| **Source Maps** | ✅ Yes | ❌ No |
| **Optimized Build** | ❌ No | ✅ Yes |
| **Error Details** | ✅ Verbose | ⚠️ Limited |
| **Performance** | ⚠️ Slower | ✅ Fast |

---

## Next Steps

1. ✅ Get the app running locally
2. ✅ Create a test report
3. ✅ Explore the codebase
4. ✅ Make changes and see hot reload
5. ✅ Test your changes
6. ✅ Push to git (CI/CD deploys automatically)

---

## Getting Help

- Check logs in terminal
- Check browser console (F12)
- Check worker logs
- Review error messages
- Check Supabase dashboard for data

---

**Happy coding! 🚀**

