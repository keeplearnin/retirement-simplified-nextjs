#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Retirement.Simplified — One-Click AWS Deploy
# Run this after you have your Google OAuth credentials
# ═══════════════════════════════════════════════════════════

set -e

echo "╔═══════════════════════════════════════╗"
echo "║   Retirement.Simplified AWS Deploy    ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI not found. Run: brew install awscli && aws configure"; exit 1; }
command -v sam >/dev/null 2>&1 || { echo "❌ SAM CLI not found. Run: brew install aws-sam-cli"; exit 1; }

# Prompt for credentials if not set
if [ -z "$GOOGLE_CLIENT_ID" ]; then
  GOOGLE_CLIENT_ID="474528284405-mrq49p9q0k30gmhps76vj7v36vpvl4fm.apps.googleusercontent.com"
  echo "📋 Using Google Client ID: ${GOOGLE_CLIENT_ID:0:20}..."
fi
if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  read -sp "🔐 Google Client Secret: " GOOGLE_CLIENT_SECRET
  echo ""
fi

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="retirement-simplified"
DOMAIN_PREFIX="retirement-simplified-$(openssl rand -hex 3)"
FRONTEND_URL="https://keeplearnin.github.io/retirement-simplified"

echo ""
echo "📦 Building SAM application..."
cd "$(dirname "$0")/infrastructure"
sam build

echo ""
echo "🚀 Deploying to AWS ($REGION)..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --parameter-overrides \
    "GoogleClientId=$GOOGLE_CLIENT_ID" \
    "GoogleClientSecret=$GOOGLE_CLIENT_SECRET" \
    "AppDomainPrefix=$DOMAIN_PREFIX" \
    "FrontendUrl=$FRONTEND_URL" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-confirm-changeset

echo ""
echo "✅ Deployment complete!"
echo ""
echo "═══════════════════════════════════════"
echo "📋 Fetching outputs..."
echo "═══════════════════════════════════════"

# Get outputs
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
COGNITO_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='CognitoDomain'].OutputValue" --output text)

echo ""
echo "🔧 Your AWS_CONFIG values:"
echo "═══════════════════════════════════════"
echo "  region:           '$REGION'"
echo "  apiUrl:           '$API_URL'"
echo "  userPoolId:       '$USER_POOL_ID'"
echo "  userPoolClientId: '$CLIENT_ID'"
echo "  cognitoDomain:    '$COGNITO_DOMAIN'"
echo "═══════════════════════════════════════"
echo ""

# Auto-update index.html
INDEX_FILE="$(dirname "$0")/index.html"
if [ -f "$INDEX_FILE" ]; then
  echo "✏️  Updating index.html with config values..."
  
  # Use sed to replace the config values
  sed -i.bak "s|region:           '',|region:           '$REGION',|" "$INDEX_FILE"
  sed -i.bak "s|apiUrl:           '',|apiUrl:           '$API_URL',|" "$INDEX_FILE"
  sed -i.bak "s|userPoolId:       '',|userPoolId:       '$USER_POOL_ID',|" "$INDEX_FILE"
  sed -i.bak "s|userPoolClientId: '',|userPoolClientId: '$CLIENT_ID',|" "$INDEX_FILE"
  sed -i.bak "s|cognitoDomain:    '',|cognitoDomain:    '$COGNITO_DOMAIN',|" "$INDEX_FILE"
  rm -f "${INDEX_FILE}.bak"
  
  echo "✅ index.html updated!"
  echo ""
  echo "📤 Next steps:"
  echo "   1. Update Google OAuth redirect URI to:"
  echo "      ${COGNITO_DOMAIN}/oauth2/idpresponse"
  echo "   2. Push to GitHub:"
  echo "      git add -A && git commit -m 'Configure AWS backend' && git push"
  echo "   3. Visit: $FRONTEND_URL"
else
  echo "⚠️  index.html not found at $INDEX_FILE"
  echo "   Manually update AWS_CONFIG in index.html with the values above."
fi

echo ""
echo "🎉 Done! Your retirement planner now has persistent storage."
