import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';
const context = Buffer.from('dashboard-meta-ads:meta-token:v1', 'utf8');

function parseKey(value: string) {
  const trimmed = value.trim();
  const key = /^[a-f\d]{64}$/i.test(trimmed) ? Buffer.from(trimmed, 'hex') : Buffer.from(trimmed, 'base64');
  if (key.length !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY deve representar exatamente 32 bytes em base64 ou hexadecimal.');
  return key;
}

export function encryptMetaToken(token: string, keyValue = process.env.META_TOKEN_ENCRYPTION_KEY) {
  if (!keyValue) throw new Error('META_TOKEN_ENCRYPTION_KEY não configurada.');
  const iv = randomBytes(12); const cipher = createCipheriv(algorithm, parseKey(keyValue), iv); cipher.setAAD(context);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptMetaToken(payload: string, keyValue = process.env.META_TOKEN_ENCRYPTION_KEY) {
  if (!keyValue) throw new Error('META_TOKEN_ENCRYPTION_KEY não configurada.');
  const [version, ivValue, tagValue, encryptedValue] = payload.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) throw new Error('Token Meta criptografado em formato inválido.');
  const decipher = createDecipheriv(algorithm, parseKey(keyValue), Buffer.from(ivValue, 'base64url')); decipher.setAAD(context); decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}
