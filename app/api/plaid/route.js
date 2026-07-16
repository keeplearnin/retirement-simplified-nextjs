import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { savePlaidItem, getPlaidItems, deletePlaidItem } from '@/lib/db';

// ---------------------------------------------------------------------------
// Plaid API Routes — real aggregation, env-gated.
//
// Activates when PLAID_CLIENT_ID + PLAID_SECRET are set. Until then every
// action returns { configured: false } and the client falls back to the
// built-in demo institution picker, so production keeps working with no keys.
//
// To go live:
//   1. npm install plaid   (already in package.json)
//   2. Sign up at https://dashboard.plaid.com, grab Client ID + a Secret
//   3. Set in the environment (Amplify console → env vars):
//        PLAID_CLIENT_ID=...
//        PLAID_SECRET=...
//        PLAID_ENV=sandbox         # sandbox | production
//   4. Create a DynamoDB table `plaid_items` (PK userId, SK itemId) — or with
//      your DYNAMODB_TABLE_PREFIX — for server-side access-token storage.
//
// Access tokens are secrets: stored server-side only, never returned to the
// client, never logged.
// ---------------------------------------------------------------------------

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID ?? '';
const PLAID_SECRET = process.env.PLAID_SECRET ?? '';
const PLAID_ENV = process.env.PLAID_ENV ?? 'sandbox';
const isConfigured = () => Boolean(PLAID_CLIENT_ID && PLAID_SECRET);

// Lazily construct the client so the module imports cleanly with no keys.
let _client = null;
async function getPlaidClient() {
  if (_client) return _client;
  const { Configuration, PlaidApi, PlaidEnvironments } = await import('plaid');
  _client = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET },
      },
    })
  );
  return _client;
}

// Normalize a Plaid account into the shape lib/plaidMapping.js consumes.
function normalizeAccount(a, institutionName) {
  return {
    id: a.account_id,
    name: a.name,
    officialName: a.official_name,
    institution: institutionName,
    type: a.type,
    subtype: a.subtype,
    balance: a.balances?.current ?? 0,
    mask: a.mask,
  };
}

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`plaid:${ip}`, 15, 60_000);
    if (rateLimited) return rateLimited;

    const userId = authResult.sub;
    const body = await request.json();
    const { action } = body;

    // ── Not configured → tell the client to use demo mode ──
    if (!isConfigured()) {
      return NextResponse.json({ configured: false, demo: true });
    }

    const plaid = await getPlaidClient();

    // =====================================================================
    // create-link-token — opens Plaid Link on the client
    // =====================================================================
    if (action === 'create-link-token') {
      const { Products, CountryCode } = await import('plaid');
      const resp = await plaid.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Retire.Simplified',
        products: [Products.Investments],
        country_codes: [CountryCode.Us],
        language: 'en',
      });
      return NextResponse.json({
        configured: true,
        link_token: resp.data.link_token,
        expiration: resp.data.expiration,
      });
    }

    // =====================================================================
    // exchange-token — swap the public_token for a stored access_token
    // =====================================================================
    if (action === 'exchange-token') {
      const { public_token } = body;
      if (!public_token) {
        return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
      }
      const exchange = await plaid.itemPublicTokenExchange({ public_token });
      const accessToken = exchange.data.access_token;
      const itemId = exchange.data.item_id;

      // Look up the institution name for display.
      let institutionName = 'Linked institution';
      try {
        const item = await plaid.itemGet({ access_token: accessToken });
        const instId = item.data.item.institution_id;
        if (instId) {
          const { CountryCode } = await import('plaid');
          const inst = await plaid.institutionsGetById({
            institution_id: instId,
            country_codes: [CountryCode.Us],
          });
          institutionName = inst.data.institution.name;
        }
      } catch { /* name is best-effort */ }

      await savePlaidItem(userId, itemId, accessToken, institutionName);
      return NextResponse.json({ configured: true, linked: true, itemId, institutionName });
    }

    // =====================================================================
    // get-accounts — fetch balances across all of the user's linked items
    // =====================================================================
    if (action === 'get-accounts') {
      const items = await getPlaidItems(userId);
      const accounts = [];
      const institutions = [];
      for (const item of items) {
        try {
          const res = await plaid.accountsBalanceGet({ access_token: item.access_token });
          institutions.push({ itemId: item.item_id, name: item.institution_name });
          for (const a of res.data.accounts) {
            accounts.push(normalizeAccount(a, item.institution_name));
          }
        } catch (e) {
          // One bad item (revoked login, etc.) shouldn't fail the whole sync.
          console.error('Plaid accountsBalanceGet failed for an item:', e?.message);
          institutions.push({ itemId: item.item_id, name: item.institution_name, error: true });
        }
      }
      return NextResponse.json({ configured: true, accounts, institutions });
    }

    // =====================================================================
    // unlink — remove an institution
    // =====================================================================
    if (action === 'unlink') {
      const { itemId } = body;
      if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
      const items = await getPlaidItems(userId);
      const target = items.find((i) => i.item_id === itemId);
      if (target) {
        try { await plaid.itemRemove({ access_token: target.access_token }); } catch { /* best effort */ }
        await deletePlaidItem(userId, itemId);
      }
      return NextResponse.json({ configured: true, unlinked: true });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use create-link-token | exchange-token | get-accounts | unlink.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Plaid API error:', error?.response?.data ?? error?.message ?? error);
    return NextResponse.json({ error: 'Something went wrong connecting to your bank. Please try again.' }, { status: 500 });
  }
}
