#!/bin/bash

##############################################################################
# Disable HTTP Trigger Mode (Rollback to Polling)
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Disable HTTP Trigger Mode (Rollback to Polling)            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PROJECT_ID="wealth-report"
LOCATION="europe-west1"
WEB_SERVICE="report-generator"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Project:     ${PROJECT_ID}"
echo -e "   Location:    ${LOCATION}"
echo -e "   Web Service: ${WEB_SERVICE}"
echo ""

echo -e "${YELLOW}⏳ Reverting to database polling mode...${NC}"
echo ""

gcloud run services update $WEB_SERVICE \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --update-env-vars "JOB_TRIGGER_MODE=db" \
  --quiet

echo -e "${GREEN}✅ Web service updated${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Rollback complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Worker will now use database polling (1 second interval)"
echo ""

