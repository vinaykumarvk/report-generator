#!/bin/bash

echo "⚙️  Worker Scaling Configuration"
echo "================================"
echo ""

PROJECT_ID="wealth-report"
REGION="europe-west1"
WORKER_SERVICE="report-generator-worker"

echo "Choose scaling mode:"
echo ""
echo "1. Always Running (min=1, max=1)"
echo "   • Cost: ~\$70/month"
echo "   • No cold start delay"
echo "   • Best for: Production, high usage"
echo ""
echo "2. Scale to Zero (min=0, max=1)"
echo "   • Cost: ~\$5-20/month (90% savings!)"
echo "   • 10-30 second cold start"
echo "   • Best for: Development, low usage"
echo ""
echo "3. Scale to Zero with Auto-scaling (min=0, max=3)"
echo "   • Cost: ~\$5-30/month"
echo "   • Handles bursts of jobs"
echo "   • Best for: Variable usage"
echo ""
echo "4. Business Hours Only (min=1, max=1)"
echo "   • Cost: ~\$32/month"
echo "   • No delay during business hours"
echo "   • Best for: Predictable usage"
echo ""

read -p "Enter choice (1-4): " choice
echo ""

case $choice in
  1)
    echo "🚀 Configuring: Always Running"
    echo ""
    gcloud run services update $WORKER_SERVICE \
      --region $REGION \
      --project $PROJECT_ID \
      --min-instances 1 \
      --max-instances 1
    echo ""
    echo "✅ Worker will always be running"
    echo "   Cost: ~\$70/month"
    ;;
    
  2)
    echo "💰 Configuring: Scale to Zero"
    echo ""
    gcloud run services update $WORKER_SERVICE \
      --region $REGION \
      --project $PROJECT_ID \
      --min-instances 0 \
      --max-instances 1 \
      --cpu-throttling
    echo ""
    echo "✅ Worker will scale to zero when idle"
    echo "   Cost: ~\$5-20/month"
    echo "   Note: First job after idle will take 10-30 seconds"
    ;;
    
  3)
    echo "📈 Configuring: Scale to Zero with Auto-scaling"
    echo ""
    gcloud run services update $WORKER_SERVICE \
      --region $REGION \
      --project $PROJECT_ID \
      --min-instances 0 \
      --max-instances 3 \
      --cpu-throttling
    echo ""
    echo "✅ Worker will scale to zero when idle"
    echo "   Can scale up to 3 instances for bursts"
    echo "   Cost: ~\$5-30/month (depends on usage)"
    ;;
    
  4)
    echo "⏰ Business Hours Mode"
    echo ""
    echo "This requires Cloud Scheduler to be set up."
    echo "For now, setting to always running (min=1)."
    echo ""
    echo "To implement scheduled scaling:"
    echo "1. Create two Cloud Scheduler jobs:"
    echo "   - Morning (8 AM): Scale up to min=1"
    echo "   - Evening (6 PM): Scale down to min=0"
    echo ""
    echo "See COST-OPTIMIZATION.md for details."
    echo ""
    gcloud run services update $WORKER_SERVICE \
      --region $REGION \
      --project $PROJECT_ID \
      --min-instances 1 \
      --max-instances 1
    ;;
    
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Current Configuration:"
    echo ""
    gcloud run services describe $WORKER_SERVICE \
      --region $REGION \
      --project $PROJECT_ID \
      --format="table(
        spec.template.metadata.annotations['autoscaling.knative.dev/minScale']:label='MIN_INSTANCES',
        spec.template.metadata.annotations['autoscaling.knative.dev/maxScale']:label='MAX_INSTANCES',
        spec.template.spec.containers[0].resources.limits.memory:label='MEMORY',
        spec.template.spec.containers[0].resources.limits.cpu:label='CPU'
      )"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ Configuration updated successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Test job processing"
    echo "   2. Monitor costs in Cloud Console"
    echo "   3. Adjust as needed"
    echo ""
    echo "💡 Tip: See COST-OPTIMIZATION.md for more details"
    echo ""
else
    echo ""
    echo "❌ Failed to update configuration"
    exit 1
fi

