// There are no accounts. Each browser gets a random device ID on first visit,
// and every API call carries it as X-Device-Id. See lib/apiAuth.ts for what
// that does and does not protect.

const DEVICE_ID_KEY = 'rs:device-id-v1';

const Auth = {
  /**
   * Returns a stable per-browser UUID. Generated on first call, persisted to
   * localStorage. Used as the partition key for this browser's server-side
   * data (plan sync, chat history, email preferences).
   */
  getDeviceId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      // crypto.randomUUID is universally available in modern browsers.
      // Fallback to a manual UUID for unusual environments.
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: string) => {
            const r = Math.floor(Math.random() * 16);
            const v = c === '8' ? (r & 0x3) | 0x8 : r;
            return v.toString(16);
          });
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  },

  /** Headers for an API call: JSON content type plus this browser's device ID. */
  getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Device-Id': this.getDeviceId(),
    };
  },
};

export default Auth;
