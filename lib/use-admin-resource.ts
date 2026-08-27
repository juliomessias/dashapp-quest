'use client';

import { useCallback, useEffect, useState } from 'react';

type ResourceState<T> = { key: string; data: T | null; error: string };

export function useAdminResource<T>(resource: string) {
  const [revision, setRevision] = useState(0);
  const key = `${resource}:${revision}`;
  const [state, setState] = useState<ResourceState<T>>({ key: '', data: null, error: '' });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/${resource}`, { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Falha ao carregar.'); return body as T;
    }).then((data) => setState({ key, data, error: '' })).catch((reason) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setState({ key, data: null, error: reason instanceof Error ? reason.message : 'Falha ao carregar.' });
    });
    return () => controller.abort();
  }, [key, resource]);
  const loading = state.key !== key;
  return { data: loading ? null : state.data, loading, error: loading ? '' : state.error, reload };
}

export async function mutateAdmin(resource: string, method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, id?: string) {
  const response = await fetch(`/api/admin/${resource}${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error ?? 'Não foi possível salvar.') as Error & { status?: number; duplicateId?: string }; error.status = response.status; error.duplicateId = data.duplicateId; throw error; }
  window.dispatchEvent(new CustomEvent('meta-bi:data-changed')); return data;
}
