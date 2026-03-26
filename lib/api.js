import Auth, { isConfigured } from './auth';

const API = {
  async _fetch(path, method = 'GET', body = null) {
    const token = Auth.getIdToken();
    if (!token || !isConfigured()) return null;
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
      };
      if (body) opts.body = JSON.stringify(body);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const resp = await fetch(`${apiUrl}${path}`, opts);
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      return await resp.json();
    } catch (e) {
      console.error(`API error (${method} ${path}):`, e);
      return null;
    }
  },
  async listPlans() { return this._fetch('/plans'); },
  async savePlan(planData) { return this._fetch('/plans', 'POST', planData); },
  async updatePlan(planId, planData) { return this._fetch(`/plans/${planId}`, 'PUT', planData); },
  async deletePlan(planId) { return this._fetch(`/plans/${planId}`, 'DELETE'); },
  async listJournal(startDate, endDate) {
    const qs = startDate ? `?startDate=${startDate}&endDate=${endDate || '2099-12-31'}` : '';
    return this._fetch(`/journal${qs}`);
  },
  async saveJournal(entry) { return this._fetch('/journal', 'POST', entry); },
  async deleteJournal(date) { return this._fetch(`/journal/${date}`, 'DELETE'); },
  async listMonteCarlo() { return this._fetch('/montecarlo'); },
  async saveMonteCarlo(result) { return this._fetch('/montecarlo', 'POST', result); },
  async getProfile() { return this._fetch('/profile'); },
  async saveProfile(data) { return this._fetch('/profile', 'POST', data); },
};

export default API;
