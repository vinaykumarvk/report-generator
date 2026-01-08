#!/bin/bash

##############################################################################
# Test Cloud Tasks Setup and Job Triggering
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Test Cloud Tasks Setup                               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PROJECT_ID="${CLOUD_TASKS_PROJECT:-wealth-report}"
LOCATION="${CLOUD_TASKS_LOCATION:-europe-west1}"
QUEUE_NAME="${CLOUD_TASKS_QUEUE:-job-queue}"
WORKER_SERVICE_NAME="report-generator-worker"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Project:   ${PROJECT_ID}"
echo -e "   Location:  ${LOCATION}"
echo -e "   Queue:     ${QUEUE_NAME}"
echo ""

# Test 1: Check if queue exists
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 1: Checking if Cloud Tasks queue exists${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
  echo -e "${GREEN}✅ Queue exists${NC}"
  gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID
else
  echo -e "${RED}❌ Queue does not exist${NC}"
  echo -e "${YELLOW}💡 Run: ./scripts/setup-cloud-tasks.sh${NC}"
  exit 1
fi
echo ""

# Test 2: Check worker service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 2: Checking worker service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

WORKER_URL=$(gcloud run services describe $WORKER_SERVICE_NAME \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "$WORKER_URL" ]; then
  echo -e "${RED}❌ Worker service not deployed${NC}"
  echo -e "${YELLOW}💡 Deploy worker first: gcloud run deploy $WORKER_SERVICE_NAME${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Worker service deployed${NC}"
echo -e "   URL: ${WORKER_URL}"
echo ""

# Test 3: Test worker health endpoint
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 3: Testing worker health endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Worker is healthy${NC}"
  echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  echo -e "${RED}❌ Worker health check failed${NC}"
  echo "$HEALTH_RESPONSE"
  exit 1
fi
echo ""

# Test 4: Check web service environment variables
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 4: Checking web service configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

WEB_ENV=$(gcloud run services describe report-generator \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(spec.template.spec.containers[0].env)' 2>/dev/null || echo "")

echo "Checking required environment variables..."

MISSING_VARS=0

for VAR in JOB_TRIGGER_MODE CLOUD_TASKS_PROJECT CLOUD_TASKS_LOCATION CLOUD_TASKS_QUEUE WORKER_TRIGGER_URL; do
  if echo "$WEB_ENV" | grep -q "$VAR"; then
    echo -e "   ${GREEN}✅ ${VAR}${NC}"
  else
    echo -e "   ${RED}❌ ${VAR} (missing)${NC}"
    MISSING_VARS=1
  fi
done

if [ $MISSING_VARS -eq 1 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Some environment variables are missing${NC}"
  echo -e "${YELLOW}💡 Run: ./scripts/setup-cloud-tasks.sh${NC}"
  echo ""
fi
echo ""

# Test 4b: Check worker service environment variables
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 4b: Checking worker service configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

WORKER_ENV=$(gcloud run services describe $WORKER_SERVICE_NAME \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(spec.template.spec.containers[0].env)' 2>/dev/null || echo "")

for VAR in JOB_TRIGGER_MODE WORKER_TRIGGER_SECRET; do
  if echo "$WORKER_ENV" | grep -q "$VAR"; then
    echo -e "   ${GREEN}✅ ${VAR}${NC}"
  else
    echo -e "   ${RED}❌ ${VAR} (missing)${NC}"
    MISSING_VARS=1
  fi
done
echo ""

# Test 5: Check queue stats
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 5: Checking queue statistics${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

gcloud tasks queues describe $QUEUE_NAME \
  --location=$LOCATION \
  --project=$PROJECT_ID \
  --format=json | jq '{
    name: .name,
    state: .state,
    maxConcurrentDispatches: .rateLimits.maxConcurrentDispatches,
    maxAttempts: .retryConfig.maxAttempts
  }'
echo ""

# Test 6: List recent tasks
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 6: Listing recent tasks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TASK_COUNT=$(gcloud tasks list \
  --queue=$QUEUE_NAME \
  --location=$LOCATION \
  --project=$PROJECT_ID \
  --limit=10 \
  --format='value(name)' 2>/dev/null | wc -l)

echo -e "Tasks in queue: ${TASK_COUNT}"

if [ $TASK_COUNT -gt 0 ]; then
  echo ""
  echo "Recent tasks:"
  gcloud tasks list \
    --queue=$QUEUE_NAME \
    --location=$LOCATION \
    --project=$PROJECT_ID \
    --limit=5
fi
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        TEST COMPLETE!                                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $MISSING_VARS -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo -e "${GREEN}✅ Cloud Tasks setup is working correctly${NC}"
  echo ""
  echo -e "${YELLOW}🚀 Next steps:${NC}"
  echo -e "   1. Create a test report run in the web UI"
  echo -e "   2. Check worker logs: gcloud run services logs read $WORKER_SERVICE_NAME --region $LOCATION"
  echo -e "   3. Monitor queue: gcloud tasks queues describe $QUEUE_NAME --location $LOCATION"
else
  echo -e "${YELLOW}⚠️  Some configuration issues found${NC}"
  echo -e "${YELLOW}💡 Fix the issues above before testing${NC}"
fi
echo ""



