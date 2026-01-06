#!/bin/bash

echo "🔧 Fixing Worker Service Configuration"
echo "======================================="
echo ""

PROJECT_ID="wealth-report"
REGION="europe-west1"
WORKER_SERVICE="report-generator-worker"
DEFAULT_WORKSPACE_ID="c8e2bd7a-abe8-4ae2-9d77-720fabab07e4"

echo "This will update the worker service with the correct environment variables:"
echo ""
echo "  ✅ SERVICE_MODE=worker"
echo "  ✅ NODE_ENV=production"
echo "  ✅ DEFAULT_WORKSPACE_ID=$DEFAULT_WORKSPACE_ID"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Updating worker service..."
echo ""

gcloud run services update $WORKER_SERVICE \
  --region $REGION \
  --project $PROJECT_ID \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=$DEFAULT_WORKSPACE_ID"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Worker service updated successfully!"
    echo ""
    echo "The service will restart automatically with the new configuration."
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Next steps:"
    echo ""
    echo "1. Wait 30 seconds for the service to restart"
    echo ""
    echo "2. Check worker logs to verify it's running in WORKER mode:"
    echo "   gcloud run services logs read $WORKER_SERVICE --region $REGION --limit 50"
    echo ""
    echo "   Look for: '🚀 Starting in WORKER mode...'"
    echo ""
    echo "3. Create a test job from the web UI"
    echo ""
    echo "4. Watch the worker process it in real-time:"
    echo "   gcloud run services logs read $WORKER_SERVICE --region $REGION --follow"
    echo ""
    echo "   You should see: 'Processing job: <job-id>'"
    echo ""
    echo "5. Verify the job status changes:"
    echo "   QUEUED → IN_PROGRESS → COMPLETED"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    echo ""
    echo "❌ Failed to update worker service"
    echo ""
    echo "Check if you have the necessary permissions and try again."
    exit 1
fi



