import { auth } from './firebase';

// ============================================================================
// Thin client for the serverless API.
//
// Every call carries a fresh Firebase ID token — the server's only accepted
// proof of identity. Nothing here ever sends a uid or role in the body; the
// server derives both from the verified token.
// ============================================================================

export type ApiErrorCode =
  | 'method_not_allowed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'conflict'
  | 'provider_error'
  | 'server_error'
  | 'network_error';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: string;
  code?: ApiErrorCode;
}

export async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError('You are signed out. Sign in again to continue.', 401, 'unauthenticated');
  }

  let res: Response;
  try {
    const token = await user.getIdToken();
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'We could not reach MeroDoctor. Check your connection and try again.',
      0,
      'network_error',
    );
  }

  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiErrorBody | null;
    if (parsed?.error) throw new ApiError(parsed.error, res.status, parsed.code ?? 'server_error');

    // A non-OK response with no JSON body means the request never reached our
    // handler — the endpoint is missing (404) or the platform errored before
    // the function ran. Say so plainly: reporting this as a generic failure
    // sends people hunting for a bug in code that was never executed.
    throw new ApiError(
      `The consultation service did not respond (HTTP ${res.status} at ${path}). ` +
        'If you are running locally, make sure the dev server was restarted after ' +
        'the API was added, and that the server environment variables are set.',
      res.status,
      res.status === 404 ? 'not_found' : 'server_error',
    );
  }

  return (await res.json()) as T;
}
