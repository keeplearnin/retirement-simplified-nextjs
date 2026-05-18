#!/usr/bin/env bash
# Creates the 3 DynamoDB tables retire-simplified needs.
#
# Usage:
#   AWS_REGION=us-east-1 ./scripts/create-dynamodb-tables.sh
#   # or with a prefix to share an account between staging/prod:
#   DYNAMODB_TABLE_PREFIX=rs_prod_ AWS_REGION=us-east-1 ./scripts/create-dynamodb-tables.sh
#
# All tables use PAY_PER_REQUEST billing — no provisioned capacity, no minimum
# bill. At ~1K users you're paying pennies/month if anything.

set -euo pipefail

AWS_REGION="${AWS_REGION:?AWS_REGION is required}"
PREFIX="${DYNAMODB_TABLE_PREFIX:-}"

create_table() {
  local name="${PREFIX}$1"
  local schema="$2"

  if aws dynamodb describe-table --region "$AWS_REGION" --table-name "$name" >/dev/null 2>&1; then
    echo "✓ $name already exists — skipping"
    return
  fi

  echo "Creating $name ..."
  # shellcheck disable=SC2086
  aws dynamodb create-table \
    --region "$AWS_REGION" \
    --table-name "$name" \
    --billing-mode PAY_PER_REQUEST \
    $schema \
    >/dev/null
  echo "✓ $name created"
}

# user_plans: simple PK on userId
create_table user_plans "
  --attribute-definitions AttributeName=userId,AttributeType=S
  --key-schema AttributeName=userId,KeyType=HASH
"

# plan_snapshots: PK=userId, SK=savedAt (so we can Query a user's history
# ordered by date and Limit to the most recent N)
create_table plan_snapshots "
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=savedAt,AttributeType=S
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=savedAt,KeyType=RANGE
"

# user_preferences: simple PK on userId
create_table user_preferences "
  --attribute-definitions AttributeName=userId,AttributeType=S
  --key-schema AttributeName=userId,KeyType=HASH
"

echo ""
echo "Done. Tables created in region $AWS_REGION."
echo ""
echo "Next: grant your Amplify SSR IAM role permission on these tables."
echo "See docs/dynamodb-setup.md for the IAM policy JSON."
