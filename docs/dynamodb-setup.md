# DynamoDB Setup

How to provision the 3 tables retire-simplified needs and grant Amplify access.

---

## 1. Create the tables

```bash
chmod +x scripts/create-dynamodb-tables.sh
AWS_REGION=us-east-1 ./scripts/create-dynamodb-tables.sh
```

Creates three pay-per-request tables:

| Table | Partition key | Sort key | Purpose |
|-------|---------------|----------|---------|
| `user_plans` | `userId` (S) | — | Current plan, one row per user |
| `plan_snapshots` | `userId` (S) | `savedAt` (S) | Daily snapshots, max 90 per user |
| `user_preferences` | `userId` (S) | — | Email opt-in + last emailed timestamp |

All three use **PAY_PER_REQUEST** billing — no provisioned capacity, no minimum bill.

### Optional: table prefix

If you want staging and prod to share an AWS account but not data, set a prefix:

```bash
DYNAMODB_TABLE_PREFIX=rs_prod_ AWS_REGION=us-east-1 ./scripts/create-dynamodb-tables.sh
```

Then set the same prefix on the running app via the `DYNAMODB_TABLE_PREFIX` env var.

---

## 2. Grant Amplify access

The Amplify SSR Lambda runs with an IAM role — you need to add a policy giving it read/write on these three tables.

### IAM policy JSON

Replace `<REGION>`, `<ACCOUNT_ID>`, and the table-name prefix to match your setup:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/user_plans",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/plan_snapshots",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/user_preferences"
      ]
    }
  ]
}
```

### Attach the policy

1. AWS Console → Amplify → your app → App settings → **Service role**
2. Click the role → **Add permissions** → **Create inline policy** → paste JSON above
3. Save

Amplify SSR functions automatically pick up the role credentials via the AWS SDK default chain — no env vars needed in production.

---

## 3. Local dev credentials

Locally the SDK uses your AWS CLI credentials. Either:

```bash
# Option A: AWS CLI profile (cleanest)
aws configure --profile retiresimplified
# Then set AWS_PROFILE=retiresimplified in your shell

# Option B: explicit env vars in .env.local
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Either way, `AWS_REGION` must be set (`.env.local.example` includes it).

---

## 4. Verify it works

After tables are created and credentials are wired:

```bash
# Smoke test from the running app — assumes you're signed in
curl -X POST http://localhost:3000/api/db/preferences \
  -H "Authorization: Bearer <COGNITO_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"weeklyCheckEnabled": true, "email": "you@example.com"}'

# Confirm it persisted:
curl http://localhost:3000/api/db/preferences \
  -H "Authorization: Bearer <COGNITO_ID_TOKEN>"
# → { "preferences": { "email": "you@example.com", "weeklyCheckEnabled": true }, "dbConfigured": true }
```

`dbConfigured: false` means `AWS_REGION` isn't set on the server — fix that first.

---

## 5. Cost expectations

At under 1,000 active users:

| Item | Monthly cost |
|------|--------------|
| Read/write requests | ~$0–2 |
| Storage (<100 MB) | $0 (under free tier) |
| **Total** | **~$0–2** |

The first 25 GB of storage and 200M read/write requests/month are free under the AWS Free Tier perpetually (not just first 12 months).

---

## 6. Removing the tables

```bash
aws dynamodb delete-table --region us-east-1 --table-name user_plans
aws dynamodb delete-table --region us-east-1 --table-name plan_snapshots
aws dynamodb delete-table --region us-east-1 --table-name user_preferences
```

⚠️ Irreversible — exports first if you care about the data.
