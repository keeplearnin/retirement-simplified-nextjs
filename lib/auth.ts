import type { UserProfile } from './types';

interface AuthConfig {
  region: string;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  cognitoDomain: string;
  redirectUri: string;
}

interface AuthTokens {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

const getConfig = (): AuthConfig => ({
  region: process.env.NEXT_PUBLIC_AWS_REGION || '',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
  userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '',
  cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
  redirectUri: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
});

export const isConfigured = (): boolean => {
  const c = getConfig();
  return !!(c.region && c.apiUrl && c.userPoolClientId);
};

const Auth = {
  getTokens(): AuthTokens | null {
    try { return JSON.parse(sessionStorage.getItem('rs_tokens') || 'null'); } catch { return null; }
  },
  setTokens(tokens: AuthTokens): void {
    sessionStorage.setItem('rs_tokens', JSON.stringify(tokens));
  },
  clearTokens(): void {
    sessionStorage.removeItem('rs_tokens');
  },
  getUser(): UserProfile | null {
    const tokens = this.getTokens();
    if (!tokens?.id_token) return null;
    try {
      const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { this.clearTokens(); return null; }
      return { name: payload.name || payload.email, given_name: payload.given_name, email: payload.email, sub: payload.sub, picture: payload.picture };
    } catch { return null; }
  },
  getAccessToken(): string | null {
    const tokens = this.getTokens();
    if (!tokens?.access_token) return null;
    try {
      const payload = JSON.parse(atob(tokens.access_token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { this.clearTokens(); return null; }
      return tokens.access_token;
    } catch { return null; }
  },
  getIdToken(): string | null {
    const tokens = this.getTokens();
    if (!tokens?.id_token) return null;
    try {
      const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { this.clearTokens(); return null; }
      return tokens.id_token;
    } catch { return null; }
  },
  signIn(): void {
    const config = getConfig();
    if (!isConfigured()) return;
    const params = new URLSearchParams({
      client_id: config.userPoolClientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: config.redirectUri,
      identity_provider: 'Google',
    });
    window.location.href = `${config.cognitoDomain}/oauth2/authorize?${params}`;
  },
  signOut(): void {
    this.clearTokens();
    const config = getConfig();
    if (!isConfigured()) return;
    const params = new URLSearchParams({
      client_id: config.userPoolClientId,
      logout_uri: config.redirectUri,
    });
    window.location.href = `${config.cognitoDomain}/logout?${params}`;
  },
  async handleCallback(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const config = getConfig();
    if (!code || !isConfigured()) return false;
    window.history.replaceState({}, '', window.location.pathname);
    try {
      const resp = await fetch(`${config.cognitoDomain}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.userPoolClientId,
          code,
          redirect_uri: config.redirectUri,
        }),
      });
      if (!resp.ok) throw new Error('Token exchange failed');
      const tokens: AuthTokens = await resp.json();
      this.setTokens(tokens);
      return true;
    } catch (e) {
      console.error('Auth callback error:', e);
      return false;
    }
  },
};

export default Auth;
