import { NextResponse } from 'next/server';

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
      //   // Optional: specify account filters
      //   // account_filters: {
      //   //   investment: { account_subtypes: ['401k', 'ira', 'roth', 'brokerage'] },
      //   //   depository: { account_subtypes: ['checking', 'savings'] },
      //   // },
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
    // The access_token should be stored securely server-side (e.g., database)
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
      //
      // const accessToken = exchangeResponse.data.access_token;
      // const itemId = exchangeResponse.data.item_id;
      //
      // // TODO: Store accessToken and itemId in your database, associated
      // // with the authenticated user. NEVER send access_token to the client.
      //
      // // Fetch accounts using the new access_token
      // const accountsResponse = await plaidClient.accountsGet({
      //   access_token: accessToken,
      // });
      //
      // // For investment accounts, also fetch holdings
      // // const holdingsResponse = await plaidClient.investmentsHoldingsGet({
      // //   access_token: accessToken,
      // // });
      //
      // return NextResponse.json({
      //   item_id: itemId,
      //   accounts: accountsResponse.data.accounts.map(acct => ({
      //     id: acct.account_id,
      //     name: acct.name,
      //     official_name: acct.official_name,
      //     type: acct.type,
      //     subtype: acct.subtype,
      //     balance: acct.balances.current,
      //     available: acct.balances.available,
      //     currency: acct.balances.iso_currency_code,
      //   })),
      //   institution: accountsResponse.data.item.institution_id,
      // });
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
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
