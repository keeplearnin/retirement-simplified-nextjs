'use client';

/**
 * plaidClient.js — browser-side Plaid Link orchestration.
 *
 * The ONE necessary external dependency in this app: bank OAuth can only run
 * through Plaid's hosted Link widget, so we load their script — but lazily,
 * only when the user actually clicks Connect and only when the server reports
 * Plaid is configured. With no keys, startLink() resolves { demo: true } and
 * the caller falls back to the built-in demo institution picker.
 */

import Auth from '@/lib/auth';

const PLAID_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

let scriptPromise = null;
function loadPlaidScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Plaid) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLAID_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('Failed to load Plaid Link')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function plaidPost(action, extra = {}) {
  const res = await fetch('/api/plaid', {
    method: 'POST',
    headers: Auth.getAuthHeaders(),
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) throw new Error(`Plaid ${action} failed (${res.status})`);
  return res.json();
}

/**
 * Start the Link flow. Resolves:
 *   { demo: true }                      → Plaid not configured; use demo picker
 *   { linked: true, institutionName }   → user completed a real connection
 *   { cancelled: true }                 → user closed Link
 * Rejects on script/network errors.
 */
export async function startLink() {
  const tokenResp = await plaidPost('create-link-token');
  if (tokenResp.configured === false) return { demo: true };
  const linkToken = tokenResp.link_token;
  if (!linkToken) throw new Error('No link token returned');

  await loadPlaidScript();

  return new Promise((resolve, reject) => {
    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken) => {
        try {
          const ex = await plaidPost('exchange-token', { public_token: publicToken });
          resolve({ linked: true, institutionName: ex.institutionName, itemId: ex.itemId });
        } catch (e) {
          reject(e);
        }
      },
      onExit: (err) => {
        if (err) reject(new Error(err.display_message || err.error_message || 'Link exited'));
        else resolve({ cancelled: true });
      },
    });
    handler.open();
  });
}

/** Fetch normalized balances across all of the user's linked institutions. */
export async function fetchLinkedAccounts() {
  const resp = await plaidPost('get-accounts');
  if (resp.configured === false) return { demo: true, accounts: [], institutions: [] };
  return { accounts: resp.accounts || [], institutions: resp.institutions || [] };
}

export async function unlinkInstitution(itemId) {
  return plaidPost('unlink', { itemId });
}
