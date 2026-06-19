import { buildExampleFromSchema } from './buildExampleFromSchema';
import { buildFieldId, describeBodyFieldId } from './fieldIds';
import { buildRequestUrl, sendApiRequest } from './sendApiRequest';
import { useMemo, useRef, useState } from 'react';
import type { NormalizedEndpoint } from '../openapi';

/**
 * Headless state machine for the "try it out" request form. Lives in `lib/`
 * (not write-gated) so the validation, submit-guard, and token-security logic
 * is unit-testable apart from the brand-locked JSX in `RequestForm`.
 *
 * Token security: the raw token is held only here and forwarded straight to
 * `sendApiRequest` as the Authorization header – it is never written into any
 * state the UI renders (CONSTRAINT token-security).
 */

/** The current submit phase, surfaced for aria-busy + button disabling. */
export type RequestPhase = 'idle' | 'sending';

/** The result the response panel renders, or `null` before the first send. */
export interface RequestOutcome {
  ok: boolean;
  statusLine: string;
  body: string;
}

interface UseRequestFormInput {
  endpoint: NormalizedEndpoint;
  headingId: string;
  serverOrigin: string;
  token: string;
  /** True when the form is inert (logged-out or token still loading). */
  inert: boolean;
}

interface UseRequestFormResult {
  paramFieldId: (location: string, name: string) => string;
  bodyFieldId: string;
  paramValues: Record<string, string>;
  paramErrors: Record<string, string>;
  bodyValue: string;
  bodyError: string;
  summaryError: string;
  phase: RequestPhase;
  outcome: RequestOutcome | null;
  statusMessage: string;
  setParamValue: (key: string, value: string) => void;
  setBodyValue: (value: string) => void;
  /** Returns the field id to focus when validation fails, else null. */
  submit: () => Promise<string | null>;
}

const PARAM_KEY_SEPARATOR = '::';

function paramKey(location: string, name: string): string {
  return `${location}${PARAM_KEY_SEPARATOR}${name}`;
}

export function useRequestForm({
  endpoint,
  headingId,
  serverOrigin,
  token,
  inert,
}: UseRequestFormInput): UseRequestFormResult {
  const bodyFieldId = describeBodyFieldId(headingId);

  const initialBody = useMemo(() => {
    if (!endpoint.requestBody) return '';
    const example = buildExampleFromSchema(endpoint.requestBody.schema);
    return JSON.stringify(example, null, 2);
  }, [endpoint.requestBody]);

  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});
  const [bodyValue, setBodyValueState] = useState<string>(initialBody);
  const [bodyError, setBodyError] = useState<string>('');
  const [summaryError, setSummaryError] = useState<string>('');
  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [outcome, setOutcome] = useState<RequestOutcome | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Mirror the phase into a ref so the submit guard reads the latest value
  // without depending on a stale closure.
  const phaseRef = useRef<RequestPhase>('idle');
  phaseRef.current = phase;

  function setParamValue(key: string, value: string) {
    setParamValues((previous) => ({ ...previous, [key]: value }));
    setParamErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function setBodyValue(value: string) {
    setBodyValueState(value);
    if (bodyError) setBodyError('');
  }

  async function submit(): Promise<string | null> {
    if (inert || phaseRef.current === 'sending') return null;

    // Validate required params (trimmed) in DOM order.
    const nextParamErrors: Record<string, string> = {};
    let firstInvalidFieldId: string | null = null;
    for (const parameter of endpoint.parameters) {
      if (!parameter.required) continue;
      const key = paramKey(parameter.location, parameter.name);
      if ((paramValues[key] ?? '').trim() === '') {
        nextParamErrors[key] = `Enter a value for ${parameter.name}.`;
        if (!firstInvalidFieldId) {
          firstInvalidFieldId = buildFieldId(
            headingId,
            parameter.location,
            parameter.name,
          );
        }
      }
    }

    // Validate the JSON body.
    let parsedBody: unknown = undefined;
    let nextBodyError = '';
    if (endpoint.requestBody && bodyValue.trim() !== '') {
      try {
        parsedBody = JSON.parse(bodyValue);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Something went wrong';
        nextBodyError = `Request body is not valid JSON: ${message}.`;
        if (!firstInvalidFieldId) firstInvalidFieldId = bodyFieldId;
      }
    }

    setParamErrors(nextParamErrors);
    setBodyError(nextBodyError);

    if (firstInvalidFieldId) {
      setSummaryError('Fix the highlighted fields, then send the request.');
      return firstInvalidFieldId;
    }
    setSummaryError('');

    // Build the request and fire it.
    const pathParams: Record<string, string> = {};
    const queryParams: Record<string, string> = {};
    for (const parameter of endpoint.parameters) {
      const key = paramKey(parameter.location, parameter.name);
      const value = paramValues[key] ?? '';
      if (parameter.location === 'path') pathParams[parameter.name] = value;
      else queryParams[parameter.name] = value;
    }

    const url = buildRequestUrl({
      serverOrigin,
      path: endpoint.path,
      pathParams,
      queryParams,
    });
    const isGet = endpoint.method.toLowerCase() === 'get';
    const body =
      !isGet && parsedBody !== undefined ? JSON.stringify(parsedBody) : null;

    setPhase('sending');
    setOutcome(null);
    setStatusMessage('Sending request…');

    try {
      const result = await sendApiRequest({
        url,
        method: endpoint.method,
        token,
        body,
      });
      const statusLine = `${result.status} ${result.statusText}`.trim();
      setOutcome({ ok: result.ok, statusLine, body: result.body });
      setStatusMessage(`Response received: ${statusLine}.`);
    } catch {
      const reach = serverOrigin === '' ? 'the server' : serverOrigin;
      const statusLine = `Could not reach ${reach}.`;
      setOutcome({ ok: false, statusLine, body: '' });
      setStatusMessage(`Request failed: could not reach ${reach}.`);
    } finally {
      setPhase('idle');
    }

    return null;
  }

  return {
    paramFieldId: (location, name) => buildFieldId(headingId, location, name),
    bodyFieldId,
    paramValues,
    paramErrors,
    bodyValue,
    bodyError,
    summaryError,
    phase,
    outcome,
    statusMessage,
    setParamValue,
    setBodyValue,
    submit,
  };
}

export { paramKey };
