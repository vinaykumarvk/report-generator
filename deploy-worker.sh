#!/bin/bash

echo "🚀 Deploying Worker Service to Google Cloud Run"
echo "================================================"
echo ""

# Configuration
PROJECT_ID="wealth-report"
REGION="europe-west1"
SERVICE_NAME="report-generator-worker"
DEFAULT_WORKSPACE_ID="c8e2bd7a-abe8-4ae2-9d77-720fabab07e4"

echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo "   Workspace ID: $DEFAULT_WORKSPACE_ID"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "   Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Error: Not logged in to gcloud"
    echo "   Run: gcloud auth login"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Confirm deployment
read -p "🤔 Deploy worker service? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🔨 Building and deploying worker service..."
echo ""

# Deploy worker service
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --project "$PROJECT_ID" \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=$DEFAULT_WORKSPACE_ID"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Worker service deployed successfully!"
    echo ""
    echo "📊 Next steps:"
    echo ""
    echo "1. Check worker status:"
    echo "   gcloud run services describe $SERVICE_NAME --region $REGION"
    echo ""
    echo "2. View worker logs:"
    echo "   gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"
    echo ""
    echo "3. Test the worker health endpoint:"
    echo "   WORKER_URL=\$(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')"
    echo "   curl -H \"Authorization: Bearer \$(gcloud auth print-identity-token)\" \$WORKER_URL/health"
    echo ""
    echo "4. Monitor job processing:"
    echo "   Watch the logs for job processing activity"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   1. Check if you have the necessary permissions"
    echo "   2. Verify the project ID is correct"
    echo "   3. Check if Cloud Run API is enabled"
    echo "   4. Review the error messages above"
    echo ""
    exit 1
fi

