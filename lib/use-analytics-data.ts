'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AnalyticsResponse } from './analytics-types';

type AnalyticsState = { key: string; data: AnalyticsResponse | null; error: string };

export function useAnalyticsData() {
  const params = useSearchParams(); const router = useRouter(); const [revision, setRevision] = useState(0); const requestId = useRef(0);
  const query = params.toString(); const key = `${query}:${revision}`; const [state, setState] = useState<AnalyticsState>({ key: '', data: null, error: '' });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => { window.addEventListener('meta-bi:data-changed', reload); return () => window.removeEventListener('meta-bi:data-changed', reload); }, [reload]);
  useEffect(() => {
    const controller = new AbortController(); const id = ++requestId.current;
    fetch(`/api/analytics?${query}`, { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (response.status === 401) { router.replace(`/login?callbackUrl=${encodeURIComponent(location.pathname + location.search)}`); return null; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Não foi possível carregar os dados.'); return body as AnalyticsResponse;
    }).then((body) => { if (body && id === requestId.current) setState({ key, data: body, error: '' }); }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (id === requestId.current) setState({ key, data: null, error: reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.' });
    });
    return () => controller.abort();
  }, [key, query, router]);
  const loading = state.key !== key;
  return { data: loading ? null : state.data, loading, error: loading ? '' : state.error, reload };
}
