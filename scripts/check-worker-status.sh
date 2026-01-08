#!/bin/bash

echo "🔍 Checking Worker Service Status"
echo "=================================="
echo ""

PROJECT_ID="wealth-report"
REGION="europe-west1"
WORKER_SERVICE="report-generator-worker"

# Check if worker service exists
echo "1️⃣ Checking if worker service is deployed..."
echo "---"
WORKER_EXISTS=$(gcloud run services list --region $REGION --project $PROJECT_ID --format="value(metadata.name)" 2>/dev/null | grep -c "^${WORKER_SERVICE}$")

if [ "$WORKER_EXISTS" -eq "0" ]; then
    echo "❌ Worker service NOT found!"
    echo ""
    echo "The worker service '${WORKER_SERVICE}' is not deployed."
    echo ""
    echo "To deploy it, run:"
    echo "  ./deploy-worker.sh"
    echo ""
    exit 1
else
    echo "✅ Worker service found: ${WORKER_SERVICE}"
    echo ""
fi

# Get worker service details
echo "2️⃣ Worker Service Details..."
echo "---"
gcloud run services describe $WORKER_SERVICE \
    --region $REGION \
    --project $PROJECT_ID \
    --format="table(
        status.url,
        status.conditions[0].status:label='READY',
        spec.template.spec.containers[0].resources.limits.memory:label='MEMORY',
        spec.template.spec.containers[0].resources.limits.cpu:label='CPU',
        spec.template.metadata.annotations['autoscaling.knative.dev/minScale']:label='MIN',
        spec.template.metadata.annotations['autoscaling.knative.dev/maxScale']:label='MAX'
    )" 2>/dev/null
echo ""

# Check environment variables
echo "3️⃣ Environment Variables..."
echo "---"
ENV_VARS=$(gcloud run services describe $WORKER_SERVICE \
    --region $REGION \
    --project $PROJECT_ID \
    --format="value(spec.template.spec.containers[0].env)" 2>/dev/null)

if echo "$ENV_VARS" | grep -q "SERVICE_MODE"; then
    SERVICE_MODE=$(echo "$ENV_VARS" | grep "SERVICE_MODE" | sed 's/.*value: //')
    if [ "$SERVICE_MODE" = "worker" ]; then
        echo "✅ SERVICE_MODE=worker (correct)"
    else
        echo "❌ SERVICE_MODE=$SERVICE_MODE (should be 'worker')"
    fi
else
    echo "❌ SERVICE_MODE not set!"
fi

if echo "$ENV_VARS" | grep -q "DEFAULT_WORKSPACE_ID"; then
    WORKSPACE_ID=$(echo "$ENV_VARS" | grep "DEFAULT_WORKSPACE_ID" | sed 's/.*value: //')
    echo "✅ DEFAULT_WORKSPACE_ID=$WORKSPACE_ID"
else
    echo "⚠️  DEFAULT_WORKSPACE_ID not set"
fi
echo ""

# Check recent logs
echo "4️⃣ Recent Worker Logs (last 20 lines)..."
echo "---"
gcloud run services logs read $WORKER_SERVICE \
    --region $REGION \
    --project $PROJECT_ID \
    --limit 20 2>/dev/null | tail -20
echo ""

# Check if worker is actively processing
echo "5️⃣ Checking for Active Job Processing..."
echo "---"
RECENT_LOGS=$(gcloud run services logs read $WORKER_SERVICE \
    --region $REGION \
    --project $PROJECT_ID \
    --limit 100 2>/dev/null)

if echo "$RECENT_LOGS" | grep -q "Starting in WORKER mode"; then
    echo "✅ Worker started successfully"
else
    echo "⚠️  No worker startup message found"
fi

if echo "$RECENT_LOGS" | grep -q "Health check server listening"; then
    echo "✅ Health check server is running"
else
    echo "⚠️  Health check server not detected"
fi

if echo "$RECENT_LOGS" | grep -q "Processing job"; then
    echo "✅ Worker is actively processing jobs"
    JOB_COUNT=$(echo "$RECENT_LOGS" | grep -c "Processing job")
    echo "   Found $JOB_COUNT job processing entries in recent logs"
else
    echo "⚠️  No recent job processing activity detected"
    echo "   (This is normal if no jobs have been queued recently)"
fi
echo ""

# Test health endpoint
echo "6️⃣ Testing Worker Health Endpoint..."
echo "---"
WORKER_URL=$(gcloud run services describe $WORKER_SERVICE \
    --region $REGION \
    --project $PROJECT_ID \
    --format='value(status.url)' 2>/dev/null)

if [ -n "$WORKER_URL" ]; then
    echo "Worker URL: $WORKER_URL"
    echo ""
    echo "Health check response:"
    TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
    if [ -n "$TOKEN" ]; then
        curl -s -H "Authorization: Bearer $TOKEN" "$WORKER_URL/health" 2>/dev/null | jq . 2>/dev/null || echo "Health endpoint not responding"
    else
        echo "⚠️  Could not get auth token"
    fi
else
    echo "❌ Could not get worker URL"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 SUMMARY"
echo ""

if [ "$WORKER_EXISTS" -eq "1" ]; then
    echo "✅ Worker service is deployed"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Check logs for errors:"
    echo "      gcloud run services logs read $WORKER_SERVICE --region $REGION --limit 50"
    echo ""
    echo "   2. Follow logs in real-time:"
    echo "      gcloud run services logs read $WORKER_SERVICE --region $REGION --follow"
    echo ""
    echo "   3. Create a test job and watch it process"
    echo ""
else
    echo "❌ Worker service is NOT deployed"
    echo ""
    echo "Run: ./deploy-worker.sh"
fi

echo ""




