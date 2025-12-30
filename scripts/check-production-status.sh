#!/bin/bash

echo "🔍 PRODUCTION STATUS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://report-generator-47249889063.europe-west1.run.app"

echo "1️⃣ Testing Web Service Health..."
echo "---"
curl -s "$BASE_URL/api/health" 2>&1 | head -20
echo -e "\n"

echo "2️⃣ Testing Templates API..."
echo "---"
TEMPLATES=$(curl -s "$BASE_URL/api/templates" 2>&1)
echo "$TEMPLATES" | head -20
TEMPLATE_COUNT=$(echo "$TEMPLATES" | grep -o '"id"' | wc -l | tr -d ' ')
echo ""
echo "Templates found: $TEMPLATE_COUNT"
echo ""

echo "3️⃣ Checking if Worker is Deployed..."
echo "---"
echo "The worker should be a separate Cloud Run service."
echo "Check: https://console.cloud.google.com/run?project=wealth-report"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 DIAGNOSIS:"
echo ""

if [ "$TEMPLATE_COUNT" -eq "0" ]; then
    echo "❌ ISSUE 1: No templates returned"
    echo "   Possible causes:"
    echo "   - DEFAULT_WORKSPACE_ID not set in deployment"
    echo "   - Wrong workspace ID being used"
    echo "   - Database connection issue"
    echo ""
fi

echo "❌ ISSUE 2: Jobs stuck in QUEUED status"
echo "   This means the WORKER is not running!"
echo ""
echo "   The worker is a SEPARATE service that needs to be deployed."
echo "   It should be named: report-generator-worker"
echo ""

echo "🔧 FIXES NEEDED:"
echo ""
echo "1. Check if worker service exists:"
echo "   gcloud run services list --region europe-west1"
echo ""
echo "2. If worker doesn't exist, deploy it:"
echo "   gcloud run deploy report-generator-worker \\"
echo "     --source . \\"
echo "     --region europe-west1 \\"
echo "     --platform managed \\"
echo "     --no-allow-unauthenticated \\"
echo "     --min-instances 1 \\"
echo "     --max-instances 1 \\"
echo "     --set-env-vars 'SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4'"
echo ""
echo "3. Check worker logs:"
echo "   gcloud run services logs read report-generator-worker --region europe-west1"
echo ""

