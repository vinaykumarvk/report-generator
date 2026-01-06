#!/bin/bash

##############################################################################
# Enable HTTP Trigger Mode (Minimal Setup for Testing)
# 
# This script enables HTTP trigger mode without Cloud Tasks.
# Good for testing the event-driven architecture before full Cloud Tasks setup.
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Enable HTTP Trigger Mode (Testing)                      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PROJECT_ID="wealth-report"
LOCATION="europe-west1"
WORKER_SERVICE="report-generator-worker"
WEB_SERVICE="report-generator"
WORKER_URL="https://report-generator-worker-47249889063.europe-west1.run.app"
WEB_URL="https://report-generator-47249889063.europe-west1.run.app"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Project:        ${PROJECT_ID}"
echo -e "   Location:       ${LOCATION}"
echo -e "   Worker Service: ${WORKER_SERVICE}"
echo -e "   Worker URL:     ${WORKER_URL}"
echo -e "   Web Service:    ${WEB_SERVICE}"
echo -e "   Web URL:        ${WEB_URL}"
echo ""

# Generate trigger secret
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Generating trigger secret${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TRIGGER_SECRET=$(openssl rand -hex 32)
echo -e "${GREEN}✅ Secret generated: ${TRIGGER_SECRET}${NC}"
echo ""

# Update worker service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Updating worker service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Adding WORKER_TRIGGER_SECRET to worker...${NC}"

gcloud run services update $WORKER_SERVICE \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --update-env-vars "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}" \
  --quiet

echo -e "${GREEN}✅ Worker service updated${NC}"
echo ""

# Update web service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Updating web service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Enabling HTTP trigger mode on web service...${NC}"

gcloud run services update $WEB_SERVICE \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --update-env-vars "\
JOB_TRIGGER_MODE=http,\
WORKER_TRIGGER_URL=${WORKER_URL}/process-job,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}" \
  --quiet

echo -e "${GREEN}✅ Web service updated${NC}"
echo ""

# Test worker health
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Testing worker health${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⏳ Checking worker health endpoint...${NC}"
sleep 5  # Wait for service to update

HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/health" || echo "")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Worker is healthy${NC}"
  echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  echo -e "${YELLOW}⚠️  Could not verify worker health (may still be updating)${NC}"
  echo "$HEALTH_RESPONSE"
fi
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    HTTP TRIGGER MODE ENABLED!                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Worker configured with trigger secret${NC}"
echo -e "${GREEN}✅ Web configured to trigger worker via HTTP${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 CONFIGURATION SUMMARY:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Mode:${NC} HTTP Trigger (no Cloud Tasks)"
echo -e "${YELLOW}Worker URL:${NC} ${WORKER_URL}"
echo -e "${YELLOW}Web URL:${NC} ${WEB_URL}"
echo -e "${YELLOW}Trigger Secret:${NC} ${TRIGGER_SECRET}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🧪 HOW TO TEST:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "1. Open the web app:"
echo -e "   ${WEB_URL}"
echo ""
echo -e "2. Create a test report run"
echo ""
echo -e "3. Check worker logs (should see job processing immediately):"
echo -e "   ${YELLOW}gcloud run services logs read $WORKER_SERVICE --region $LOCATION --limit 50${NC}"
echo ""
echo -e "4. Expected log output:"
echo -e "   ${GREEN}📥 Received trigger for job: <job-id>${NC}"
echo -e "   ${GREEN}✅ Claimed job: <job-id> (START_RUN)${NC}"
echo -e "   ${GREEN}✅ Job processed: <job-id>${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}💡 BENEFITS OF HTTP TRIGGER MODE:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "✅ No Cloud Tasks setup needed (minimal permissions)"
echo -e "✅ Instant job processing (no 1-second polling delay)"
echo -e "✅ Worker still has polling as fallback (safety net)"
echo -e "✅ Easy to test and debug"
echo -e "✅ Can upgrade to Cloud Tasks later for production"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔄 TO ROLLBACK TO POLLING MODE:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "   ${YELLOW}gcloud run services update $WEB_SERVICE \\${NC}"
echo -e "     --region=$LOCATION \\${NC}"
echo -e "     --update-env-vars \"JOB_TRIGGER_MODE=db\"${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💾 SAVE THIS SECRET:${NC}"
echo -e "   WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
echo ""



