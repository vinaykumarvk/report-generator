#!/bin/bash

##############################################################################
# Setup Cloud Tasks for Event-Driven Worker Architecture
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Setup Cloud Tasks for Report Generator Worker                ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PROJECT_ID="${CLOUD_TASKS_PROJECT:-wealth-report}"
LOCATION="${CLOUD_TASKS_LOCATION:-europe-west1}"
QUEUE_NAME="${CLOUD_TASKS_QUEUE:-job-queue}"
SA_NAME="worker-tasks"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_SERVICE_NAME="report-generator-worker"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Project:          ${PROJECT_ID}"
echo -e "   Location:         ${LOCATION}"
echo -e "   Queue:            ${QUEUE_NAME}"
echo -e "   Service Account:  ${SA_EMAIL}"
echo -e "   Worker Service:   ${WORKER_SERVICE_NAME}"
echo ""

# Step 1: Enable required APIs
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Enabling required APIs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Enabling Cloud Tasks API...${NC}"
gcloud services enable cloudtasks.googleapis.com --project=$PROJECT_ID

echo -e "${GREEN}✅ APIs enabled${NC}"
echo ""

# Step 2: Create service account
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Creating service account${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if service account already exists
if gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID &>/dev/null; then
  echo -e "${YELLOW}⚠️  Service account already exists: ${SA_EMAIL}${NC}"
else
  echo -e "${YELLOW}⏳ Creating service account: ${SA_EMAIL}${NC}"
  gcloud iam service-accounts create $SA_NAME \
    --display-name="Report Generator Worker Tasks" \
    --project=$PROJECT_ID
  echo -e "${GREEN}✅ Service account created${NC}"
fi
echo ""

# Step 3: Grant IAM permissions
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Granting IAM permissions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Granting cloudtasks.enqueuer role...${NC}"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudtasks.enqueuer" \
  --condition=None \
  --quiet

echo -e "${YELLOW}⏳ Granting run.invoker role for worker service...${NC}"
gcloud run services add-iam-policy-binding $WORKER_SERVICE_NAME \
  --region=$LOCATION \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" \
  --platform=managed \
  --quiet

echo -e "${GREEN}✅ IAM permissions granted${NC}"
echo ""

# Step 4: Create Cloud Tasks queue
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Creating Cloud Tasks queue${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if queue already exists
if gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
  echo -e "${YELLOW}⚠️  Queue already exists: ${QUEUE_NAME}${NC}"
  echo ""
  echo -e "${BLUE}Current queue configuration:${NC}"
  gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID
else
  echo -e "${YELLOW}⏳ Creating queue: ${QUEUE_NAME}${NC}"
  gcloud tasks queues create $QUEUE_NAME \
    --location=$LOCATION \
    --project=$PROJECT_ID \
    --max-concurrent-dispatches=10 \
    --max-attempts=3 \
    --max-retry-duration=1h \
    --min-backoff=10s \
    --max-backoff=5m
  
  echo -e "${GREEN}✅ Queue created${NC}"
  echo ""
  echo -e "${BLUE}Queue configuration:${NC}"
  gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID
fi
echo ""

# Step 5: Get worker URL
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Getting worker service URL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

WORKER_URL=$(gcloud run services describe $WORKER_SERVICE_NAME \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

if [ -z "$WORKER_URL" ]; then
  echo -e "${RED}❌ Could not find worker service URL${NC}"
  echo -e "${YELLOW}💡 Make sure the worker service is deployed first:${NC}"
  echo -e "   gcloud run deploy $WORKER_SERVICE_NAME --source . --region $LOCATION"
  echo ""
  WORKER_TRIGGER_URL="https://YOUR-WORKER-URL/process-job"
else
  WORKER_TRIGGER_URL="${WORKER_URL}/process-job"
  echo -e "${GREEN}✅ Worker URL found: ${WORKER_URL}${NC}"
fi
echo ""

# Step 6: Generate secret
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Generating trigger secret${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Generate a random secret
TRIGGER_SECRET=$(openssl rand -hex 32)
echo -e "${GREEN}✅ Secret generated${NC}"
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                          SETUP COMPLETE!                              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Cloud Tasks queue created${NC}"
echo -e "${GREEN}✅ Service account configured${NC}"
echo -e "${GREEN}✅ IAM permissions granted${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 ENVIRONMENT VARIABLES FOR WEB SERVICE:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "JOB_TRIGGER_MODE=cloud-tasks"
echo "CLOUD_TASKS_PROJECT=${PROJECT_ID}"
echo "CLOUD_TASKS_LOCATION=${LOCATION}"
echo "CLOUD_TASKS_QUEUE=${QUEUE_NAME}"
echo "WORKER_TASK_SERVICE_ACCOUNT=${SA_EMAIL}"
echo "WORKER_TRIGGER_URL=${WORKER_TRIGGER_URL}"
echo "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 ENVIRONMENT VARIABLES FOR WORKER SERVICE:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "JOB_TRIGGER_MODE=cloud-tasks"
echo "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🚀 NEXT STEPS:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "1. Deploy/update the web service with the environment variables above:"
echo ""
echo -e "   ${YELLOW}gcloud run deploy report-generator \\${NC}"
echo -e "     --region $LOCATION \\${NC}"
echo -e "     --set-env-vars \"\\"
echo -e "       JOB_TRIGGER_MODE=cloud-tasks,\\"
echo -e "       CLOUD_TASKS_PROJECT=${PROJECT_ID},\\"
echo -e "       CLOUD_TASKS_LOCATION=${LOCATION},\\"
echo -e "       CLOUD_TASKS_QUEUE=${QUEUE_NAME},\\"
echo -e "       WORKER_TASK_SERVICE_ACCOUNT=${SA_EMAIL},\\"
echo -e "       WORKER_TRIGGER_URL=${WORKER_TRIGGER_URL},\\"
echo -e "       WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}\""
echo ""
echo -e "2. Deploy/update the worker service:"
echo ""
echo -e "   ${YELLOW}gcloud run deploy $WORKER_SERVICE_NAME \\${NC}"
echo -e "     --region $LOCATION \\${NC}"
echo -e "     --set-env-vars \"WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}\""
echo ""
echo -e "3. Test the setup:"
echo ""
echo -e "   ${YELLOW}./scripts/test-cloud-tasks.sh${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💾 Save these environment variables securely!${NC}"
echo -e "${YELLOW}   Especially: WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}${NC}"
echo ""
