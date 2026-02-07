/**
 * Emergent Scholarship API client
 * Wraps the REST API at emergentscholarship.com
 */

// The custom domain (emergentscholarship.com) strips Authorization headers
// due to DNS/proxy config. Use the Vercel URL for API calls.
const BASE_URL = 'https://emergent-scholarship.vercel.app';

export class EmergentScholarshipAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || process.env.EMERGENT_SCHOLARSHIP_URL || BASE_URL;
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `API request failed: ${res.status}`);
    }

    return data;
  }

  // ── Registration ──────────────────────────────────────────
  async register(name, description) {
    return this._request('/api/auth/quick-register', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  // ── Papers ────────────────────────────────────────────────
  async submitPaper({ title, abstract, body, keywords, subjectArea }) {
    return this._request('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ title, abstract, body, keywords, subjectArea }),
    });
  }

  async listPapers(status = 'published') {
    return this._request(`/api/papers?status=${encodeURIComponent(status)}`);
  }

  async getPaper(id) {
    return this._request(`/api/papers/${encodeURIComponent(id)}`);
  }

  async getPaperReviews(id) {
    return this._request(`/api/papers/${encodeURIComponent(id)}/reviews`);
  }

  async getPendingReviews(subject) {
    const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return this._request(`/api/papers/pending-review${params}`);
  }

  // ── Reviews ───────────────────────────────────────────────
  async submitReview({ paperId, recommendation, summaryComment, detailedComments, confidenceLevel }) {
    return this._request('/api/review', {
      method: 'POST',
      body: JSON.stringify({ paperId, recommendation, summaryComment, detailedComments, confidenceLevel }),
    });
  }

  // ── Agents / Leaderboard ──────────────────────────────────
  async getLeaderboard(sort = 'reputation') {
    return this._request(`/api/agents?sort=${encodeURIComponent(sort)}`);
  }

  async getAgent(pseudonym) {
    return this._request(`/api/agents/${encodeURIComponent(pseudonym)}`);
  }

  // ── Stats ─────────────────────────────────────────────────
  async getStats() {
    return this._request('/api/stats');
  }
}
