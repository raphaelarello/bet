import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface WebhookOddsEntry {
  matchId: string;
  source: string;
  provider?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
  over25Odds?: number | null;
  under25Odds?: number | null;
  over85CornersOdds?: number | null;
  over35CardsOdds?: number | null;
  receivedAt: number;
  raw?: unknown;
}

interface HookResult {
  entries: WebhookOddsEntry[];
  latestByMatch: Record<string, WebhookOddsEntry>;
  current: WebhookOddsEntry | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  seedDemoData: () => Promise<boolean>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Falha HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useOddsWebhookSync(matchId?: string | null, enabled = true): HookResult {
  const [entries, setEntries] = useState<WebhookOddsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchJson<{ entries: WebhookOddsEntry[] }>('/api/webhooks/odds/latest');
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar sincronização');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
    if (!enabled) return;
    const timer = window.setInterval(() => void refetch(), 15000);
    return () => window.clearInterval(timer);
  }, [enabled, refetch]);

  const latestByMatch = useMemo(() => {
    return entries.reduce<Record<string, WebhookOddsEntry>>((acc, entry) => {
      acc[entry.matchId] = entry;
      return acc;
    }, {});
  }, [entries]);

  const current = matchId ? latestByMatch[matchId] ?? null : null;

  const seedDemoData = useCallback(async () => {
    try {
      await fetchJson('/api/webhooks/odds/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      await refetch();
      return true;
    } catch {
      return false;
    }
  }, [refetch]);

  return { entries, latestByMatch, current, loading, error, refetch, seedDemoData };
}
