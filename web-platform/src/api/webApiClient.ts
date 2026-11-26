import type { ProPlanTier } from '@app/config/appReleaseConfig';
import type { MindMapDocument } from '@app/types/mindmap';

export interface WebUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: number;
}

export interface AuthStateResponse {
  authenticated: boolean;
  user: WebUser | null;
  csrfToken: string | null;
}

export interface ActiveSessionItem {
  sessionId: string;
  device: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

export interface SecurityAuditLogItem {
  id: number;
  event_type: string;
  detail: string;
  created_at: number;
}

export interface SharedLinkItem {
  slug: string;
  mapId: string;
  title: string;
  hasPassword: boolean;
  expiresAt: number | null;
  viewCount: number;
  createdAt: number;
}

export interface PublicShareResponse {
  slug: string;
  title: string;
  requiresPassword: boolean;
  expiresAt: number | null;
  createdAt: number;
  viewCount: number;
  document: MindMapDocument | null;
}

export interface BillingOrderItem {
  id: string;
  plan_tier: ProPlanTier;
  amount_try: number;
  currency: string;
  status: string;
  card_brand: string;
  card_last4: string;
  receipt_no: string;
  created_at: number;
}

export interface BillingStatusResponse {
  authenticated?: boolean;
  isPro: boolean;
  planTier: 'free' | ProPlanTier;
  status: string;
  trialEligible: boolean;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  orderRef: string | null;
  orders: BillingOrderItem[];
}

export interface CheckoutResponse {
  ok: boolean;
  purchased: boolean;
  isTrial: boolean;
  productId: string;
  transactionId: string;
  receiptNo: string;
  billing: BillingStatusResponse;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(status: number, message: string, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let currentCsrfToken: string | null = null;

export function setApiCsrfToken(token: string | null): void {
  currentCsrfToken = token;
}

export function getApiCsrfToken(): string | null {
  return currentCsrfToken;
}

async function requestJson<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    'X-Requested-With': 'ZihinHaritamWeb',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      typeof data.error === 'string' ? data.error : 'İstek tamamlanamadı.',
      typeof data.code === 'string' ? data.code : 'API_ERROR'
    );
  }
  if (typeof data.csrfToken === 'string') {
    currentCsrfToken = data.csrfToken;
  }
  return data as T;
}

export const WebApi = {
  async getMe(): Promise<AuthStateResponse> {
    const res = await requestJson<AuthStateResponse>('/api/v1/auth/me');
    setApiCsrfToken(res.csrfToken ?? null);
    return res;
  },

  async register(displayName: string, email: string, password: string): Promise<AuthStateResponse> {
    const res = await requestJson<AuthStateResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: { displayName, email, password },
    });
    setApiCsrfToken(res.csrfToken ?? null);
    return res;
  },

  async login(email: string, password: string): Promise<AuthStateResponse> {
    const res = await requestJson<AuthStateResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setApiCsrfToken(res.csrfToken ?? null);
    return res;
  },

  async logout(): Promise<void> {
    await requestJson<{ ok: boolean }>('/api/v1/auth/logout', { method: 'POST', body: {} });
    setApiCsrfToken(null);
  },

  async updateProfile(displayName: string): Promise<{ ok: boolean; user: WebUser }> {
    return requestJson('/api/v1/auth/profile', {
      method: 'PATCH',
      body: { displayName },
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; csrfToken: string }> {
    const res = await requestJson<{ ok: boolean; csrfToken: string }>('/api/v1/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    setApiCsrfToken(res.csrfToken ?? null);
    return res;
  },

  async listSessions(): Promise<{ sessions: ActiveSessionItem[] }> {
    return requestJson('/api/v1/auth/sessions');
  },

  async revokeSession(sessionId: string): Promise<{ ok: boolean }> {
    return requestJson(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  async revokeOtherSessions(): Promise<{ ok: boolean }> {
    return requestJson('/api/v1/auth/sessions/revoke-others', {
      method: 'POST',
      body: {},
    });
  },

  async listAuditLogs(): Promise<{ logs: SecurityAuditLogItem[] }> {
    return requestJson('/api/v1/auth/audit-logs');
  },

  async deleteAccount(password: string): Promise<{ ok: boolean }> {
    const res = await requestJson<{ ok: boolean }>('/api/v1/auth/account', {
      method: 'DELETE',
      body: { password },
    });
    setApiCsrfToken(null);
    return res;
  },

  async listCloudMaps(): Promise<{ maps: MindMapDocument[]; syncedAt: number }> {
    return requestJson('/api/v1/maps');
  },

  async syncCloudMaps(maps: MindMapDocument[]): Promise<{
    ok: boolean;
    upserted: number;
    totalCloudMaps: number;
    maps: MindMapDocument[];
    syncedAt: number;
  }> {
    return requestJson('/api/v1/maps/sync', {
      method: 'POST',
      body: { maps },
    });
  },

  async deleteCloudMap(mapId: string): Promise<{ ok: boolean }> {
    return requestJson(`/api/v1/maps/${encodeURIComponent(mapId)}`, {
      method: 'DELETE',
    });
  },

  async listShares(): Promise<{ shares: SharedLinkItem[] }> {
    return requestJson('/api/v1/shares');
  },

  async createShare(
    document: MindMapDocument,
    expiry: '24h' | '7d' | '30d' | 'never',
    password?: string
  ): Promise<{ share: SharedLinkItem }> {
    return requestJson('/api/v1/shares', {
      method: 'POST',
      body: { document, expiry, password: password || '' },
    });
  },

  async revokeShare(slug: string): Promise<{ ok: boolean }> {
    return requestJson(`/api/v1/shares/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
  },

  async fetchPublicShare(slug: string): Promise<PublicShareResponse> {
    return requestJson(`/api/v1/public/shares/${encodeURIComponent(slug)}`);
  },

  async unlockPublicShare(slug: string, password: string): Promise<PublicShareResponse> {
    return requestJson(`/api/v1/public/shares/${encodeURIComponent(slug)}/unlock`, {
      method: 'POST',
      body: { password },
    });
  },

  async getBillingStatus(): Promise<BillingStatusResponse> {
    return requestJson('/api/v1/billing/status');
  },

  async submitCheckout(payload: {
    tier: ProPlanTier;
    cardholderName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
  }): Promise<CheckoutResponse> {
    return requestJson('/api/v1/billing/checkout', {
      method: 'POST',
      body: payload,
    });
  },

  async cancelSubscription(): Promise<{ ok: boolean; billing: BillingStatusResponse }> {
    return requestJson('/api/v1/billing/cancel', {
      method: 'POST',
      body: {},
    });
  },

  async restoreBilling(): Promise<{
    ok: boolean;
    restored: boolean;
    isLifetimePro: boolean;
    billing: BillingStatusResponse;
  }> {
    return requestJson('/api/v1/billing/restore', {
      method: 'POST',
      body: {},
    });
  },

  async redeemPromo(code: string): Promise<{ ok: boolean; redeemed: boolean; billing: BillingStatusResponse }> {
    return requestJson('/api/v1/billing/redeem-promo', {
      method: 'POST',
      body: { code },
    });
  },
};
