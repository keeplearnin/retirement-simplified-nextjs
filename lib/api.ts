import Auth, { isConfigured } from './auth';
import type { SavedPlan, JournalEntry, MonteCarloResult } from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const API = {
  async _fetch(path: string, method: HttpMethod = 'GET', body: any = null): Promise<any | null> {
    const token = Auth.getIdToken();
    if (!token || !isConfigured()) return null;
    try {
      const opts: RequestInit = {
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
  async listPlans(): Promise<SavedPlan[] | null> { return this._fetch('/plans'); },
  async savePlan(planData: Partial<SavedPlan>): Promise<SavedPlan | null> { return this._fetch('/plans', 'POST', planData); },
  async updatePlan(planId: string, planData: Partial<SavedPlan>): Promise<SavedPlan | null> { return this._fetch(`/plans/${planId}`, 'PUT', planData); },
  async deletePlan(planId: string): Promise<any | null> { return this._fetch(`/plans/${planId}`, 'DELETE'); },
  async listJournal(startDate?: string, endDate?: string): Promise<JournalEntry[] | null> {
    const qs = startDate ? `?startDate=${startDate}&endDate=${endDate || '2099-12-31'}` : '';
    return this._fetch(`/journal${qs}`);
  },
  async saveJournal(entry: Partial<JournalEntry>): Promise<JournalEntry | null> { return this._fetch('/journal', 'POST', entry); },
  async deleteJournal(date: string): Promise<any | null> { return this._fetch(`/journal/${date}`, 'DELETE'); },
  async listMonteCarlo(): Promise<MonteCarloResult[] | null> { return this._fetch('/montecarlo'); },
  async saveMonteCarlo(result: MonteCarloResult): Promise<MonteCarloResult | null> { return this._fetch('/montecarlo', 'POST', result); },
  async getProfile(): Promise<any | null> { return this._fetch('/profile'); },
  async saveProfile(data: any): Promise<any | null> { return this._fetch('/profile', 'POST', data); },
};

export default API;
