/**
 * The two readers that turn a `Response` into a value or into an error, and
 * the error type every API call rejects with. Both readers tolerate a
 * non-JSON body: servers and proxies answer with HTML often enough that a
 * parse failure has to surface as a status-carrying error rather than a
 * `SyntaxError` from somewhere in the client. A proxy or captive portal
 * answering 200 with a login page is the case that makes the success
 * reader throw rather than return nothing.
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function parseResponse<T>(
  response: Response,
): Promise<T | undefined> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      `Server returned non-JSON response: ${text.slice(0, 100)}`,
      0,
    );
  }
}

export async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  let message = text || `Request failed with ${response.status}`;
  try {
    const body = JSON.parse(text) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // body is not JSON, use the raw text as the error message
  }
  return new ApiError(message, response.status);
}
