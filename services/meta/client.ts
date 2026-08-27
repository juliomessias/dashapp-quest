import 'server-only';

type MetaPage<T> = { data: T[]; paging?: { next?: string } };
export class MetaApiError extends Error { constructor(message: string, public status: number, public code?: number) { super(message); this.name = 'MetaApiError'; } }
export class MetaClient {
  private readonly token: string; private readonly version: string;
  constructor(token: string, version = process.env.META_GRAPH_API_VERSION ?? 'v25.0', private readonly timeoutMs = 20_000, private readonly maxRetries = 4) { this.token = token.trim(); this.version = version.trim(); if (!this.token) throw new Error('Token Meta indisponível.'); if (!this.version) throw new Error('Versão da Graph API indisponível.'); }
  private async requestUrl<T>(url: URL, attempt = 0, method: 'GET' | 'DELETE' = 'GET'): Promise<T> {
    url.searchParams.delete('access_token'); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try { const response = await fetch(url, { method, signal: controller.signal, headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` }, cache: 'no-store' }); const body = await response.json() as { error?: { message?: string; code?: number } } & T;
      if (!response.ok) { if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) { const retryAfter = Number(response.headers.get('retry-after') ?? 0) * 1000; await new Promise((resolve) => setTimeout(resolve, retryAfter || Math.min(8_000, 500 * 2 ** attempt) + Math.random() * 250)); return this.requestUrl<T>(url, attempt + 1, method); } throw new MetaApiError(body.error?.message ?? 'Falha na Meta Marketing API.', response.status, body.error?.code); }
      return body;
    } catch (error) { if (error instanceof MetaApiError) throw error; if (attempt < this.maxRetries) { await new Promise((resolve) => setTimeout(resolve, Math.min(8_000, 500 * 2 ** attempt))); return this.requestUrl<T>(url, attempt + 1, method); } throw new MetaApiError(error instanceof Error && error.name === 'AbortError' ? 'Timeout na Meta Marketing API.' : 'Falha de rede na Meta Marketing API.', 503); } finally { clearTimeout(timer); }
  }
  async get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) { const url = new URL(`https://graph.facebook.com/${this.version}/${path.replace(/^\//,'')}`); Object.entries(params).forEach(([key,value])=>{if(value!==undefined)url.searchParams.set(key,String(value));}); return this.requestUrl<T>(url); }
  async delete<T>(path: string) { const url = new URL(`https://graph.facebook.com/${this.version}/${path.replace(/^\//,'')}`); return this.requestUrl<T>(url, 0, 'DELETE'); }
  async *paginate<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) { let page: MetaPage<T> | undefined = await this.get<MetaPage<T>>(path, params); while (page) { for (const item of page.data) yield item; if (!page.paging?.next) break; page = await this.requestUrl<MetaPage<T>>(new URL(page.paging.next)); } }
}
