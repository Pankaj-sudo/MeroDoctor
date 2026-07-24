import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ProviderError } from './providers/types';

// ============================================================================
// Small HTTP helpers shared by every route: consistent JSON envelopes, a single
// error funnel, and method guarding. Error responses deliberately carry a
// stable machine-readable `code` so the client can branch on it without
// string-matching human copy.
// ============================================================================

export type ApiErrorCode =
  | 'method_not_allowed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'conflict'
  | 'provider_error'
  | 'server_error';

/** An error that is safe to surface to the caller verbatim. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (m: string) => new HttpError(400, 'invalid_request', m);
export const unauthenticated = (m = 'Sign in to continue.') =>
  new HttpError(401, 'unauthenticated', m);
export const forbidden = (m = 'You do not have access to this consultation.') =>
  new HttpError(403, 'forbidden', m);
export const notFound = (m: string) => new HttpError(404, 'not_found', m);
export const conflict = (m: string) => new HttpError(409, 'conflict', m);

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  // These responses are per-user and token-bearing — never let a CDN hold them.
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function requireMethod(req: VercelRequest, method: 'GET' | 'POST'): void {
  if (req.method !== method) {
    throw new HttpError(405, 'method_not_allowed', `Use ${method} for this endpoint.`);
  }
}

/** Read a required non-empty string from the JSON body. */
export function requireString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | null | undefined)?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`"${field}" is required.`);
  }
  return value.trim();
}

/**
 * Wraps a route so every throw becomes a clean JSON error. Unexpected errors
 * are logged server-side but reported generically — internal details (stack
 * traces, provider payloads, key names) must never reach the client.
 */
export function withErrorHandling(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, code: err.code });
        return;
      }
      if (err instanceof ProviderError) {
        console.error('[api] provider failure', err);
        sendJson(res, err.status, { error: err.message, code: 'provider_error' });
        return;
      }
      console.error('[api] unhandled failure', err);
      sendJson(res, 500, {
        error: 'Something went wrong preparing the consultation room.',
        code: 'server_error',
      });
    }
  };
}
