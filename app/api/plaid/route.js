import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';

// ---------------------------------------------------------------------------
// Plaid API Routes — Placeholder with commented-out real integration
// ---------------------------------------------------------------------------
//
// SETUP REQUIRED:
//   1. Install dependency:  npm install plaid
//   2. Set environment variables in .env.local:
//        PLAID_CLIENT_ID=your_client_id
//        PLAID_SECRET=your_secret_key
//        PLAID_ENV=sandbox          # sandbox | development | production
//   3. Sign up at https://dashboard.plaid.com to get credentials
//
// PLAID INTEGRATION: Uncomment the imports and client setup below
// -----------------------------------------------------------------------
// import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
//
// const configuration = new Configuration({
//   basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
//   baseOptions: {
//     headers: {
//       'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
//       'PLAID-SECRET': process.env.PLAID_SECRET,
//     },
//   },
// });
//
// const plaidClient = new PlaidApi(configuration);
// -----------------------------------------------------------------------

export async function POST(request) {
  try {
    // --- Auth: require a valid Cognito token ---
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    // --- Rate limit: 10 requests per minute per IP ---
    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`plaid:${ip}`, 10, 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { action } = body;

    // =====================================================================
    // ACTION: create-link-token
    // Creates a Plaid Link token so the frontend can open Plaid Link UI
    // =====================================================================
    if (action === 'create-link-token') {
      // PLAID INTEGRATION: Replace mock response with real Plaid call
      // -----------------------------------------------------------
      // const response = await plaidClient.linkTokenCreate({
      //   user: { client_user_id: body.userId || 'default-user' },
      //   client_name: 'Retirement Simplified',
      //   products: [Products.Transactions, Products.Investments],
      //   country_codes: [CountryCode.Us],
      //   language: 'en',
      // });
      //
      // return NextResponse.json({
      //   link_token: response.data.link_token,
      //   expiration: response.data.expiration,
      // });
      // -----------------------------------------------------------

      // Mock response for demo/sandbox mode
      return NextResponse.json({
        link_token: 'link-sandbox-demo-' + Date.now(),
        expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      });
    }

    // =====================================================================
    // ACTION: exchange-token
    // Exchanges the public_token from Plaid Link for a persistent access_token
    // =====================================================================
    if (action === 'exchange-token') {
      const { public_token } = body;

      if (!public_token) {
        return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
      }

      // PLAID INTEGRATION: Replace mock response with real Plaid call
      // -----------------------------------------------------------
      // const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      //   public_token,
      // });
      // ...
      // -----------------------------------------------------------

      // Mock response for demo/sandbox mode
      return NextResponse.json({
        item_id: 'item-sandbox-demo-' + Date.now(),
        accounts: [],
        message: 'Demo mode — accounts are simulated on the client side.',
      });
    }

    return NextResponse.json({ error: 'Unknown action. Use "create-link-token" or "exchange-token".' }, { status: 400 });

  } catch (error) {
    console.error('Plaid API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
