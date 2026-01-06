#!/bin/bash

echo "🔍 Verifying Web and Worker Service Configuration"
echo "=================================================="
echo ""

PROJECT_ID="wealth-report"
REGION="europe-west1"
WEB_SERVICE="report-generator"
WORKER_SERVICE="report-generator-worker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 Checking both services..."
echo ""

# Check if services exist
WEB_EXISTS=$(gcloud run services list --region $REGION --project $PROJECT_ID --format="value(metadata.name)" 2>/dev/null | grep -c "^${WEB_SERVICE}$")
WORKER_EXISTS=$(gcloud run services list --region $REGION --project $PROJECT_ID --format="value(metadata.name)" 2>/dev/null | grep -c "^${WORKER_SERVICE}$")

if [ "$WEB_EXISTS" -eq "0" ]; then
    echo -e "${RED}❌ Web service NOT found: $WEB_SERVICE${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Web service found: $WEB_SERVICE${NC}"
fi

if [ "$WORKER_EXISTS" -eq "0" ]; then
    echo -e "${RED}❌ Worker service NOT found: $WORKER_SERVICE${NC}"
    echo ""
    echo "Deploy worker with: ./deploy-worker.sh"
    exit 1
else
    echo -e "${GREEN}✅ Worker service found: $WORKER_SERVICE${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get environment variables
echo "🔧 Comparing Environment Variables..."
echo ""

WEB_ENV=$(gcloud run services describe $WEB_SERVICE --region $REGION --project $PROJECT_ID --format="value(spec.template.spec.containers[0].env)" 2>/dev/null)
WORKER_ENV=$(gcloud run services describe $WORKER_SERVICE --region $REGION --project $PROJECT_ID --format="value(spec.template.spec.containers[0].env)" 2>/dev/null)

# Extract specific variables
WEB_SERVICE_MODE=$(echo "$WEB_ENV" | grep "SERVICE_MODE" | sed 's/.*value: //' | tr -d '\n')
WORKER_SERVICE_MODE=$(echo "$WORKER_ENV" | grep "SERVICE_MODE" | sed 's/.*value: //' | tr -d '\n')

WEB_WORKSPACE=$(echo "$WEB_ENV" | grep "DEFAULT_WORKSPACE_ID" | sed 's/.*value: //' | tr -d '\n')
WORKER_WORKSPACE=$(echo "$WORKER_ENV" | grep "DEFAULT_WORKSPACE_ID" | sed 's/.*value: //' | tr -d '\n')

WEB_SUPABASE=$(echo "$WEB_ENV" | grep "NEXT_PUBLIC_SUPABASE_URL" | sed 's/.*value: //' | tr -d '\n')
WORKER_SUPABASE=$(echo "$WORKER_ENV" | grep "NEXT_PUBLIC_SUPABASE_URL" | sed 's/.*value: //' | tr -d '\n')

# Check SERVICE_MODE
echo "1️⃣ SERVICE_MODE"
echo "   Web:    $WEB_SERVICE_MODE"
echo "   Worker: $WORKER_SERVICE_MODE"

if [ "$WEB_SERVICE_MODE" = "web" ] && [ "$WORKER_SERVICE_MODE" = "worker" ]; then
    echo -e "   ${GREEN}✅ SERVICE_MODE correctly configured${NC}"
elif [ -z "$WEB_SERVICE_MODE" ] && [ "$WORKER_SERVICE_MODE" = "worker" ]; then
    echo -e "   ${YELLOW}⚠️  Web SERVICE_MODE not set (will default to web)${NC}"
    echo -e "   ${GREEN}✅ Worker SERVICE_MODE correctly set${NC}"
elif [ "$WORKER_SERVICE_MODE" != "worker" ]; then
    echo -e "   ${RED}❌ Worker SERVICE_MODE is NOT 'worker'!${NC}"
    echo "   This is the problem! Worker won't process jobs."
    echo ""
    echo "   Fix with:"
    echo "   gcloud run services update $WORKER_SERVICE \\"
    echo "     --region $REGION \\"
    echo "     --set-env-vars 'SERVICE_MODE=worker'"
    ERRORS=1
else
    echo -e "   ${YELLOW}⚠️  Unexpected SERVICE_MODE values${NC}"
fi
echo ""

# Check DEFAULT_WORKSPACE_ID
echo "2️⃣ DEFAULT_WORKSPACE_ID"
echo "   Web:    $WEB_WORKSPACE"
echo "   Worker: $WORKER_WORKSPACE"

if [ -z "$WEB_WORKSPACE" ] && [ -z "$WORKER_WORKSPACE" ]; then
    echo -e "   ${YELLOW}⚠️  Neither service has DEFAULT_WORKSPACE_ID set${NC}"
    echo "   This might cause issues if you have multiple workspaces."
    echo ""
    echo "   Recommended workspace ID: c8e2bd7a-abe8-4ae2-9d77-720fabab07e4"
elif [ "$WEB_WORKSPACE" = "$WORKER_WORKSPACE" ]; then
    echo -e "   ${GREEN}✅ Both services use the same workspace ID${NC}"
elif [ -z "$WEB_WORKSPACE" ] || [ -z "$WORKER_WORKSPACE" ]; then
    echo -e "   ${YELLOW}⚠️  Only one service has workspace ID set${NC}"
    echo "   Both should have the same value for consistency."
else
    echo -e "   ${RED}❌ Services have DIFFERENT workspace IDs!${NC}"
    echo "   This will cause jobs to be invisible to the worker."
    ERRORS=1
fi
echo ""

# Check SUPABASE_URL
echo "3️⃣ NEXT_PUBLIC_SUPABASE_URL"
if [ -z "$WEB_SUPABASE" ]; then
    echo "   Web:    (using secret)"
else
    echo "   Web:    $WEB_SUPABASE"
fi

if [ -z "$WORKER_SUPABASE" ]; then
    echo "   Worker: (using secret)"
else
    echo "   Worker: $WORKER_SUPABASE"
fi

if [ -n "$WEB_SUPABASE" ] && [ -n "$WORKER_SUPABASE" ]; then
    if [ "$WEB_SUPABASE" = "$WORKER_SUPABASE" ]; then
        echo -e "   ${GREEN}✅ Both services use the same Supabase URL${NC}"
    else
        echo -e "   ${RED}❌ Services have DIFFERENT Supabase URLs!${NC}"
        echo "   They must connect to the same database."
        ERRORS=1
    fi
else
    echo -e "   ${YELLOW}⚠️  Using secrets (cannot verify if they match)${NC}"
    echo "   Ensure both services have the same SUPABASE_URL secret."
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check worker logs
echo "🔍 Checking Worker Logs..."
echo ""

WORKER_LOGS=$(gcloud run services logs read $WORKER_SERVICE --region $REGION --project $PROJECT_ID --limit 50 2>/dev/null)

if echo "$WORKER_LOGS" | grep -q "Starting in WORKER mode"; then
    echo -e "${GREEN}✅ Worker started in WORKER mode${NC}"
else
    echo -e "${RED}❌ Worker startup message not found${NC}"
    echo "   Check logs for errors:"
    echo "   gcloud run services logs read $WORKER_SERVICE --region $REGION --limit 50"
    ERRORS=1
fi

if echo "$WORKER_LOGS" | grep -q "Health check server listening"; then
    echo -e "${GREEN}✅ Health check server is running${NC}"
else
    echo -e "${YELLOW}⚠️  Health check server message not found${NC}"
fi

if echo "$WORKER_LOGS" | grep -q "Processing job"; then
    echo -e "${GREEN}✅ Worker has processed jobs recently${NC}"
    JOB_COUNT=$(echo "$WORKER_LOGS" | grep -c "Processing job")
    echo "   (Found $JOB_COUNT job processing entries)"
elif echo "$WORKER_LOGS" | grep -q "No jobs found"; then
    echo -e "${YELLOW}⚠️  No jobs processed recently (queue is empty)${NC}"
    echo "   This is normal if no jobs have been created."
else
    echo -e "${YELLOW}⚠️  No job processing activity detected${NC}"
fi

# Check for errors
ERROR_COUNT=$(echo "$WORKER_LOGS" | grep -ci "error\|failed")
if [ "$ERROR_COUNT" -gt "0" ]; then
    echo -e "${RED}❌ Found $ERROR_COUNT error messages in worker logs${NC}"
    echo ""
    echo "Recent errors:"
    echo "$WORKER_LOGS" | grep -i "error\|failed" | tail -5
    ERRORS=1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Summary
echo "📊 SUMMARY"
echo ""

if [ -z "$ERRORS" ]; then
    echo -e "${GREEN}✅ Configuration looks good!${NC}"
    echo ""
    echo "Both services are properly configured and can communicate"
    echo "through the shared database."
    echo ""
    echo "🎯 How it works:"
    echo "   1. Web service creates jobs in database (status: QUEUED)"
    echo "   2. Worker polls database every 5 seconds"
    echo "   3. Worker picks up QUEUED jobs and processes them"
    echo "   4. Worker updates job status (IN_PROGRESS → COMPLETED)"
    echo ""
    echo "No direct communication between services is needed!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Create a test job from the web UI"
    echo "   2. Watch worker logs:"
    echo "      gcloud run services logs read $WORKER_SERVICE --region $REGION --follow"
    echo "   3. Verify job status changes: QUEUED → IN_PROGRESS → COMPLETED"
else
    echo -e "${RED}❌ Configuration issues found!${NC}"
    echo ""
    echo "Please fix the issues above and try again."
    echo ""
    echo "Common fixes:"
    echo "   • Set SERVICE_MODE=worker on worker service"
    echo "   • Ensure both services have same DEFAULT_WORKSPACE_ID"
    echo "   • Ensure both services connect to same Supabase database"
    echo "   • Check worker logs for errors"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📚 For more information, see:"
echo "   • ARCHITECTURE.md - How services communicate"
echo "   • WORKER-MONITORING.md - Monitoring guide"
echo "   • PRODUCTION-FIX.md - Troubleshooting"
echo ""



