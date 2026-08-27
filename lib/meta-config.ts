import 'server-only';
import { isIP } from 'node:net';

export const metaCallbackPath = '/api/meta/callback';
export const requiredMetaPermissions = ['ads_read', 'read_insights', 'business_management'] as const;
export const metaEnvironmentVariables = [
  'META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_GRAPH_API_VERSION', 'META_TOKEN_ENCRYPTION_KEY',
] as const;

type MetaEnvironmentVariable = (typeof metaEnvironmentVariables)[number];
export type MetaConfigIssueCode =
  | 'missing'
  | 'invalid_format'
  | 'must_use_https'
  | 'invalid_public_host'
  | 'credentials_not_allowed'
  | 'callback_path_mismatch'
  | 'query_or_fragment_not_allowed'
  | 'whitespace_not_allowed';

export type MetaConfigIssue = {
  variable: MetaEnvironmentVariable;
  code: MetaConfigIssueCode;
  reason: string;
};

export type MetaConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  tokenEncryptionKey: string;
};

function rawEnvironmentValue(env: NodeJS.ProcessEnv, key: MetaEnvironmentVariable) {
  return env[key] ?? '';
}

function environmentValue(env: NodeJS.ProcessEnv, key: MetaEnvironmentVariable) {
  return rawEnvironmentValue(env, key).trim();
}

function validEncryptionKey(value: string) {
  if (/^[a-f\d]{64}$/i.test(value)) return true;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return false;
  return Buffer.from(value, 'base64').length === 32;
}

function isPublicDomain(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || isIP(host) !== 0) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  const labels = host.split('.');
  return labels.length >= 2 && labels.every((label) => /^(?!-)[a-z\d-]{1,63}(?<!-)$/.test(label));
}

function redirectUriIssues(env: NodeJS.ProcessEnv, value: string): MetaConfigIssue[] {
  const variable = 'META_REDIRECT_URI' as const;
  const issues: MetaConfigIssue[] = [];
  const rawValue = rawEnvironmentValue(env, variable);

  if (/\s/.test(rawValue)) {
    issues.push({ variable, code: 'whitespace_not_allowed', reason: 'A URL não pode conter espaços.' });
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return [...issues, { variable, code: 'invalid_format', reason: 'Use uma URL absoluta, como https://dominio.com/api/meta/callback.' }];
  }

  if (url.protocol !== 'https:') {
    issues.push({ variable, code: 'must_use_https', reason: 'A URL de callback deve utilizar HTTPS.' });
  }
  if (!isPublicDomain(url.hostname)) {
    issues.push({ variable, code: 'invalid_public_host', reason: 'Use um domínio público válido; localhost e endereços IP não são aceitos.' });
  }
  if (url.username || url.password) {
    issues.push({ variable, code: 'credentials_not_allowed', reason: 'A URL não pode conter usuário ou senha.' });
  }
  if (url.pathname !== metaCallbackPath) {
    issues.push({ variable, code: 'callback_path_mismatch', reason: `O caminho deve ser exatamente ${metaCallbackPath}, sem barra final.` });
  }
  if (url.search || url.hash) {
    issues.push({ variable, code: 'query_or_fragment_not_allowed', reason: 'A URL não pode conter parâmetros ou fragmento.' });
  }
  return issues;
}

export function metaConfigurationStatus(env: NodeJS.ProcessEnv = process.env) {
  const values = Object.fromEntries(metaEnvironmentVariables.map((key) => [key, environmentValue(env, key)])) as Record<MetaEnvironmentVariable, string>;
  const missing = metaEnvironmentVariables.filter((key) => !values[key]);
  const issues: MetaConfigIssue[] = missing.map((variable) => ({ variable, code: 'missing', reason: 'Variável não configurada.' }));

  if (values.META_GRAPH_API_VERSION && !/^v\d+\.\d+$/.test(values.META_GRAPH_API_VERSION)) {
    issues.push({ variable: 'META_GRAPH_API_VERSION', code: 'invalid_format', reason: 'Use o formato v25.0.' });
  }
  if (values.META_TOKEN_ENCRYPTION_KEY && !validEncryptionKey(values.META_TOKEN_ENCRYPTION_KEY)) {
    issues.push({ variable: 'META_TOKEN_ENCRYPTION_KEY', code: 'invalid_format', reason: 'A chave deve representar exatamente 32 bytes.' });
  }
  if (values.META_REDIRECT_URI) issues.push(...redirectUriIssues(env, values.META_REDIRECT_URI));

  const invalid = Array.from(new Set(issues.filter((issue) => issue.code !== 'missing').map((issue) => issue.variable)));
  const callbackIssues = issues.filter((issue) => issue.variable === 'META_REDIRECT_URI');
  return {
    configured: issues.length === 0,
    missing,
    invalid,
    issues,
    callback: {
      secure: Boolean(values.META_REDIRECT_URI) && callbackIssues.length === 0,
      reason: callbackIssues[0]?.reason ?? null,
    },
  };
}

export function requireMetaConfig(env: NodeJS.ProcessEnv = process.env): MetaConfig {
  const status = metaConfigurationStatus(env);
  if (status.issues.some((issue) => issue.variable === 'META_REDIRECT_URI' && issue.code === 'must_use_https')) {
    throw new Error('Não foi possível iniciar a conexão com a Meta porque a URL de callback não utiliza HTTPS. Configure META_REDIRECT_URI com uma URL pública e segura.');
  }
  if (!status.configured) {
    const blocking = Array.from(new Set(status.issues.map((issue) => issue.variable)));
    throw new Error(`Configuração Meta incompleta: ${blocking.join(', ')}.`);
  }
  return {
    appId: environmentValue(env, 'META_APP_ID'),
    appSecret: environmentValue(env, 'META_APP_SECRET'),
    redirectUri: environmentValue(env, 'META_REDIRECT_URI'),
    graphApiVersion: environmentValue(env, 'META_GRAPH_API_VERSION'),
    tokenEncryptionKey: environmentValue(env, 'META_TOKEN_ENCRYPTION_KEY'),
  };
}

export function metaIntegrationAdminUrl(env: NodeJS.ProcessEnv = process.env) {
  const redirect = new URL(requireMetaConfig(env).redirectUri);
  return new URL('/admin/integracoes/meta', redirect.origin);
}

export function isDemoMode(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && env.DEMO_MODE === 'true') throw new Error('DEMO_MODE não pode ser habilitado em produção.');
  return env.NODE_ENV !== 'production' && env.DEMO_MODE === 'true';
}

export function isLocalDatabaseMode(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && env.LOCAL_DATABASE_MODE === 'true') throw new Error('LOCAL_DATABASE_MODE não pode ser habilitado em produção.');
  return env.NODE_ENV !== 'production' && env.LOCAL_DATABASE_MODE === 'true';
}
