#!/bin/bash

##############################################################################
# Deploy Report Generator with Cloud Tasks Integration
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Deploy Report Generator with Cloud Tasks                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env file not found${NC}"
  echo -e "${YELLOW}💡 Create .env file with required variables${NC}"
  exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Configuration
PROJECT_ID="${CLOUD_TASKS_PROJECT:-wealth-report}"
LOCATION="${CLOUD_TASKS_LOCATION:-europe-west1}"
QUEUE_NAME="${CLOUD_TASKS_QUEUE:-job-queue}"
WORKER_SERVICE_NAME="report-generator-worker"
WEB_SERVICE_NAME="report-generator"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Project:        ${PROJECT_ID}"
echo -e "   Location:       ${LOCATION}"
echo -e "   Queue:          ${QUEUE_NAME}"
echo -e "   Worker Service: ${WORKER_SERVICE_NAME}"
echo -e "   Web Service:    ${WEB_SERVICE_NAME}"
echo ""

# Check if Cloud Tasks is set up
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Checking Cloud Tasks setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if ! gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
  echo -e "${YELLOW}⚠️  Cloud Tasks queue not found${NC}"
  echo -e "${YELLOW}⏳ Setting up Cloud Tasks...${NC}"
  echo ""
  ./scripts/setup-cloud-tasks.sh
  echo ""
else
  echo -e "${GREEN}✅ Cloud Tasks queue exists${NC}"
fi
echo ""

# Get worker URL (or use placeholder if not deployed yet)
WORKER_URL=$(gcloud run services describe $WORKER_SERVICE_NAME \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "$WORKER_URL" ]; then
  echo -e "${YELLOW}⚠️  Worker service not deployed yet${NC}"
  echo -e "${YELLOW}   Will deploy worker first, then update web service${NC}"
  WORKER_TRIGGER_URL="https://PLACEHOLDER/process-job"
else
  WORKER_TRIGGER_URL="${WORKER_URL}/process-job"
  echo -e "${GREEN}✅ Worker service found: ${WORKER_URL}${NC}"
fi
echo ""

# Generate secret if not set
if [ -z "$WORKER_TRIGGER_SECRET" ]; then
  WORKER_TRIGGER_SECRET=$(openssl rand -hex 32)
  echo -e "${YELLOW}⚠️  WORKER_TRIGGER_SECRET not set, generated new one:${NC}"
  echo -e "   ${WORKER_TRIGGER_SECRET}"
  echo ""
  echo -e "${YELLOW}💡 Add this to your .env file:${NC}"
  echo "WORKER_TRIGGER_SECRET=${WORKER_TRIGGER_SECRET}"
  echo ""
fi

# Get service account email
SA_NAME="worker-tasks"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Deploy worker service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Deploying worker service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Deploying $WORKER_SERVICE_NAME...${NC}"

gcloud run deploy $WORKER_SERVICE_NAME \
  --source . \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=3600 \
  --set-env-vars "SERVICE_MODE=worker,\
JOB_TRIGGER_MODE=cloud-tasks,\
WORKER_TRIGGER_SECRET=${WORKER_TRIGGER_SECRET},\
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},\
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},\
OPENAI_API_KEY=${OPENAI_API_KEY},\
DEFAULT_WORKSPACE_ID=${DEFAULT_WORKSPACE_ID}" \
  --quiet

echo -e "${GREEN}✅ Worker service deployed${NC}"
echo ""

# Get actual worker URL
WORKER_URL=$(gcloud run services describe $WORKER_SERVICE_NAME \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)')
WORKER_TRIGGER_URL="${WORKER_URL}/process-job"

echo -e "   URL: ${WORKER_URL}"
echo ""

# Deploy web service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Deploying web service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Deploying $WEB_SERVICE_NAME...${NC}"

gcloud run deploy $WEB_SERVICE_NAME \
  --source . \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --set-env-vars "SERVICE_MODE=web,\
JOB_TRIGGER_MODE=cloud-tasks,\
CLOUD_TASKS_PROJECT=${PROJECT_ID},\
CLOUD_TASKS_LOCATION=${LOCATION},\
CLOUD_TASKS_QUEUE=${QUEUE_NAME},\
WORKER_TASK_SERVICE_ACCOUNT=${SA_EMAIL},\
WORKER_TRIGGER_URL=${WORKER_TRIGGER_URL},\
WORKER_TRIGGER_SECRET=${WORKER_TRIGGER_SECRET},\
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},\
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},\
OPENAI_API_KEY=${OPENAI_API_KEY},\
DEFAULT_WORKSPACE_ID=${DEFAULT_WORKSPACE_ID}" \
  --quiet

echo -e "${GREEN}✅ Web service deployed${NC}"

WEB_URL=$(gcloud run services describe $WEB_SERVICE_NAME \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo -e "   URL: ${WEB_URL}"
echo ""

# Test the deployment
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Testing deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Testing worker health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/health")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Worker is healthy${NC}"
  echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  echo -e "${RED}❌ Worker health check failed${NC}"
  echo "$HEALTH_RESPONSE"
fi
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      DEPLOYMENT COMPLETE!                             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Worker service deployed to: ${WORKER_URL}${NC}"
echo -e "${GREEN}✅ Web service deployed to: ${WEB_URL}${NC}"
echo -e "${GREEN}✅ Cloud Tasks configured${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🚀 NEXT STEPS:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "1. Open the web app: ${WEB_URL}"
echo ""
echo -e "2. Create a test report run"
echo ""
echo -e "3. Monitor worker logs:"
echo -e "   ${YELLOW}gcloud run services logs read $WORKER_SERVICE_NAME --region $LOCATION --limit 50${NC}"
echo ""
echo -e "4. Check Cloud Tasks queue:"
echo -e "   ${YELLOW}gcloud tasks list --queue=$QUEUE_NAME --location=$LOCATION${NC}"
echo ""
echo -e "5. Run tests:"
echo -e "   ${YELLOW}./scripts/test-cloud-tasks.sh${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""


