/**
 * db.ts — DynamoDB persistence layer.
 *
 * Three tables (configurable prefix via DYNAMODB_TABLE_PREFIX):
 *   - user_plans       PK userId
 *   - plan_snapshots   PK userId, SK savedAt (YYYY-MM-DD)
 *   - user_preferences PK userId
 *
 * Gracefully degrades: if AWS region isn't resolvable, every function
 * returns null / empty without throwing. Server-side only.
 *
 * Credentials: in Amplify the IAM role is picked up automatically. For
 * local dev set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (or an AWS_PROFILE).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX ?? '';
const AWS_REGION =
  process.env.AWS_REGION ??
  process.env.NEXT_PUBLIC_AWS_REGION ??
  '';

const TABLES = {
  userPlans: `${TABLE_PREFIX}user_plans`,
  planSnapshots: `${TABLE_PREFIX}plan_snapshots`,
  userPreferences: `${TABLE_PREFIX}user_preferences`,
};

let client: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient | null {
  if (!AWS_REGION) return null;
  if (!client) {
    const raw = new DynamoDBClient({ region: AWS_REGION });
    client = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return client;
}

export function isDbConfigured(): boolean {
  return Boolean(AWS_REGION);
}

// ---------------------------------------------------------------------------
// plan_snapshots — one row per user per day
// ---------------------------------------------------------------------------

export interface DbSnapshot {
  user_id: string;
  saved_at: string;
  data: Record<string, unknown>;
  created_at: string;
}

export async function getSnapshots(userId: string, limit = 90): Promise<DbSnapshot[]> {
  const c = getClient();
  if (!c) return [];

  try {
    const res = await c.send(
      new QueryCommand({
        TableName: TABLES.planSnapshots,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
    return (res.Items ?? []).map((it) => ({
      user_id: it.userId as string,
      saved_at: it.savedAt as string,
      data: it.data as Record<string, unknown>,
      created_at: (it.createdAt as string) ?? '',
    }));
  } catch (e) {
    console.error('DynamoDB getSnapshots error:', e);
    return [];
  }
}

export async function upsertSnapshot(
  userId: string,
  savedAt: string,
  data: Record<string, unknown>
): Promise<void> {
  const c = getClient();
  if (!c) return;

  try {
    await c.send(
      new PutCommand({
        TableName: TABLES.planSnapshots,
        Item: {
          userId,
          savedAt,
          data,
          createdAt: new Date().toISOString(),
        },
      })
    );
  } catch (e) {
    console.error('DynamoDB upsertSnapshot error:', e);
  }
}

// ---------------------------------------------------------------------------
// user_plans — current plan synced across devices
// ---------------------------------------------------------------------------

export interface DbPlan {
  user_id: string;
  plan: Record<string, unknown>;
  updated_at: string;
}

export async function getUserPlan(userId: string): Promise<DbPlan | null> {
  const c = getClient();
  if (!c) return null;

  try {
    const res = await c.send(
      new GetCommand({
        TableName: TABLES.userPlans,
        Key: { userId },
      })
    );
    if (!res.Item) return null;
    return {
      user_id: res.Item.userId as string,
      plan: res.Item.plan as Record<string, unknown>,
      updated_at: (res.Item.updatedAt as string) ?? '',
    };
  } catch (e) {
    console.error('DynamoDB getUserPlan error:', e);
    return null;
  }
}

export async function upsertUserPlan(
  userId: string,
  plan: Record<string, unknown>
): Promise<void> {
  const c = getClient();
  if (!c) return;

  try {
    await c.send(
      new PutCommand({
        TableName: TABLES.userPlans,
        Item: { userId, plan, updatedAt: new Date().toISOString() },
      })
    );
  } catch (e) {
    console.error('DynamoDB upsertUserPlan error:', e);
  }
}

// ---------------------------------------------------------------------------
// user_preferences — email opt-in + scheduling state
// ---------------------------------------------------------------------------

export interface DbUserPreferences {
  user_id: string;
  email: string | null;
  weekly_check_enabled: boolean;
  last_emailed_at: string | null;
  updated_at: string;
}

export async function getUserPreferences(userId: string): Promise<DbUserPreferences | null> {
  const c = getClient();
  if (!c) return null;

  try {
    const res = await c.send(
      new GetCommand({
        TableName: TABLES.userPreferences,
        Key: { userId },
      })
    );
    if (!res.Item) return null;
    return {
      user_id: res.Item.userId as string,
      email: (res.Item.email as string) ?? null,
      weekly_check_enabled: Boolean(res.Item.weeklyCheckEnabled),
      last_emailed_at: (res.Item.lastEmailedAt as string) ?? null,
      updated_at: (res.Item.updatedAt as string) ?? '',
    };
  } catch (e) {
    console.error('DynamoDB getUserPreferences error:', e);
    return null;
  }
}

export async function upsertUserPreferences(
  userId: string,
  prefs: { email?: string; weekly_check_enabled?: boolean }
): Promise<void> {
  const c = getClient();
  if (!c) return;

  // Build a partial UPDATE so we don't clobber fields the caller didn't set.
  const sets: string[] = ['updatedAt = :now'];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ':now': new Date().toISOString() };

  if (prefs.email !== undefined) {
    sets.push('email = :email');
    values[':email'] = prefs.email;
  }
  if (prefs.weekly_check_enabled !== undefined) {
    sets.push('weeklyCheckEnabled = :wce');
    values[':wce'] = prefs.weekly_check_enabled;
  }

  try {
    await c.send(
      new UpdateCommand({
        TableName: TABLES.userPreferences,
        Key: { userId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
      })
    );
  } catch (e) {
    console.error('DynamoDB upsertUserPreferences error:', e);
  }
}

export async function updateLastEmailed(userId: string): Promise<void> {
  const c = getClient();
  if (!c) return;

  try {
    await c.send(
      new UpdateCommand({
        TableName: TABLES.userPreferences,
        Key: { userId },
        UpdateExpression: 'SET lastEmailedAt = :now, updatedAt = :now',
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
      })
    );
  } catch (e) {
    console.error('DynamoDB updateLastEmailed error:', e);
  }
}

export interface UserForWeeklyCheck {
  user_id: string;
  email: string;
  last_emailed_at: string | null;
}

/**
 * Returns users opted-in to weekly email who haven't been emailed in 6+ days.
 *
 * Uses Scan with FilterExpression — fine for <10K users. At scale, add a GSI
 * on weeklyCheckEnabled (sparse, only contains opted-in users) and Query that
 * GSI instead. Cost today: well within the 25 RCU free tier.
 */
export async function getUsersForWeeklyCheck(): Promise<UserForWeeklyCheck[]> {
  const c = getClient();
  if (!c) return [];

  const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const results: UserForWeeklyCheck[] = [];

  try {
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await c.send(
        new ScanCommand({
          TableName: TABLES.userPreferences,
          FilterExpression:
            'weeklyCheckEnabled = :true AND attribute_exists(email) AND (attribute_not_exists(lastEmailedAt) OR lastEmailedAt < :cutoff)',
          ExpressionAttributeValues: { ':true': true, ':cutoff': sixDaysAgo },
          ExclusiveStartKey,
        })
      );

      for (const item of res.Items ?? []) {
        if (item.email) {
          results.push({
            user_id: item.userId as string,
            email: item.email as string,
            last_emailed_at: (item.lastEmailedAt as string) ?? null,
          });
        }
      }
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return results;
  } catch (e) {
    console.error('DynamoDB getUsersForWeeklyCheck error:', e);
    return [];
  }
}
