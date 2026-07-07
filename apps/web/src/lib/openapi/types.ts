import type { OpenAPIV3 } from 'openapi-types';

/**
 * Normalized model the custom API docs UI renders. The raw OpenAPI document
 * is deliberately collapsed into this flatter shape so the UI never has to
 * walk `$ref`s, merge `paths`/`operations`, or reason about the difference
 * between an inline schema and a referenced one – `parseOpenApi` does all of
 * that once, up front.
 *
 * Resolved schemas are kept as `OpenAPIV3.SchemaObject` (never
 * `ReferenceObject`): every `$ref` is followed to its target AND every `allOf`
 * is flattened into its host before it lands in this model, so a UI wave can
 * read `type`, `properties`, `items`, and `example` directly without walking
 * references or unwrapping a composition.
 */

/** A single path or query parameter, with its schema already resolved. */
export interface NormalizedParameter {
  name: string;
  location: 'path' | 'query';
  required: boolean;
  description?: string;
  schema?: OpenAPIV3.SchemaObject;
}

/** One response, held in the `responses` list of {@link NormalizedEndpoint}. */
export interface NormalizedResponse {
  statusCode: string;
  description?: string;
  /** Resolved schema of the `application/json` response body, if any. */
  schema?: OpenAPIV3.SchemaObject;
}

/** A request body, with its `application/json` schema already resolved. */
export interface NormalizedRequestBody {
  required: boolean;
  description?: string;
  schema?: OpenAPIV3.SchemaObject;
}

/** One operation: a method + path pair plus its fully-resolved I/O shapes. */
export interface NormalizedEndpoint {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters: NormalizedParameter[];
  requestBody?: NormalizedRequestBody;
  /** Responses, each keyed by its status code (e.g. `'200'`, `'400'`). */
  responses: NormalizedResponse[];
}

/** Top-level spec metadata mirrored from `info`. */
export interface NormalizedInfo {
  title: string;
  description?: string;
  version: string;
}

/** The whole spec, normalized for rendering. */
export interface NormalizedApi {
  info: NormalizedInfo;
  /**
   * Origin the docs point requests at — the URL shown in each cURL example and
   * the Base URL in `WelcomePanel` — derived from the spec URL (the served
   * document declares no `servers`). Empty string means same-origin.
   */
  serverOrigin: string;
  endpoints: NormalizedEndpoint[];
}
