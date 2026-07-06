import { resolveSchema } from './resolveReference';
import type {
  NormalizedApi,
  NormalizedEndpoint,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
} from './types';
import type { OpenAPIV3 } from 'openapi-types';

/** HTTP methods the docs surface, in the order the UI lists them. */
const METHOD_ORDER = ['get', 'post', 'put', 'delete'] as const;

const JSON_MEDIA_TYPE = 'application/json';

type SchemaMap = Record<string, OpenAPIV3.SchemaObject>;

/**
 * Collapses a raw OpenAPI v3 document into the flat {@link NormalizedApi}
 * model the docs UI renders. Pure and total: a missing, empty, or malformed
 * document yields safe defaults (empty endpoint list, blank info) rather than
 * throwing, so a bad fetch never takes down the page.
 *
 * Every `$ref` is resolved against `components.schemas` here, so the returned
 * model is self-contained – no consumer needs to know about references.
 *
 * @param document The raw OpenAPI document.
 * @param serverOrigin Origin shown in the docs' cURL examples and Base URL
 *   (derived from the spec URL by the fetch layer). Empty string means
 *   same-origin.
 */
export function parseOpenApi(
  document: OpenAPIV3.Document,
  serverOrigin: string,
): NormalizedApi {
  const schemas: SchemaMap = (document?.components?.schemas ?? {}) as SchemaMap;

  return {
    info: {
      title: document?.info?.title ?? '',
      description: document?.info?.description,
      version: document?.info?.version ?? '',
    },
    serverOrigin,
    endpoints: extractEndpoints(document?.paths ?? {}, schemas),
  };
}

/** Flattens `paths` into a sorted list of method/path operation objects. */
function extractEndpoints(
  paths: OpenAPIV3.PathsObject,
  schemas: SchemaMap,
): NormalizedEndpoint[] {
  const endpoints: NormalizedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    for (const method of METHOD_ORDER) {
      const operation = pathItem[method];
      if (!operation) continue;
      endpoints.push(normalizeOperation(method, path, operation, schemas));
    }
  }

  return endpoints.sort(compareEndpoints);
}

/** Orders by method (get, post, put, delete) then path, alphabetically. */
function compareEndpoints(
  first: NormalizedEndpoint,
  second: NormalizedEndpoint,
): number {
  const methodComparison =
    METHOD_ORDER.indexOf(first.method as (typeof METHOD_ORDER)[number]) -
    METHOD_ORDER.indexOf(second.method as (typeof METHOD_ORDER)[number]);
  if (methodComparison !== 0) return methodComparison;
  return first.path.localeCompare(second.path);
}

function normalizeOperation(
  method: string,
  path: string,
  operation: OpenAPIV3.OperationObject,
  schemas: SchemaMap,
): NormalizedEndpoint {
  return {
    method,
    path,
    summary: operation.summary,
    description: operation.description,
    parameters: normalizeParameters(operation.parameters ?? [], schemas),
    requestBody: normalizeRequestBody(operation.requestBody, schemas),
    responses: normalizeResponses(operation.responses ?? {}, schemas),
  };
}

function normalizeParameters(
  parameters: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[],
  schemas: SchemaMap,
): NormalizedParameter[] {
  const normalized: NormalizedParameter[] = [];

  for (const parameter of parameters) {
    if ('$ref' in parameter) continue;
    if (parameter.in !== 'path' && parameter.in !== 'query') continue;
    normalized.push({
      name: parameter.name,
      location: parameter.in,
      required: parameter.required ?? false,
      description: parameter.description,
      schema: resolveSchema(parameter.schema, schemas),
    });
  }

  return normalized;
}

function normalizeRequestBody(
  requestBody:
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3.ReferenceObject
    | undefined,
  schemas: SchemaMap,
): NormalizedRequestBody | undefined {
  if (!requestBody || '$ref' in requestBody) return undefined;
  const schema = requestBody.content?.[JSON_MEDIA_TYPE]?.schema;
  return {
    required: requestBody.required ?? false,
    description: requestBody.description,
    schema: resolveSchema(schema, schemas),
  };
}

function normalizeResponses(
  responses: OpenAPIV3.ResponsesObject,
  schemas: SchemaMap,
): NormalizedResponse[] {
  const normalized: NormalizedResponse[] = [];

  for (const [statusCode, response] of Object.entries(responses)) {
    if (!response || '$ref' in response) continue;
    const schema = response.content?.[JSON_MEDIA_TYPE]?.schema;
    normalized.push({
      statusCode,
      description: response.description,
      schema: resolveSchema(schema, schemas),
    });
  }

  return normalized;
}
