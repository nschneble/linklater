// fetches /openapi.json and normalizes it (resolving $ref pointers) into
// the flat endpoint/parameter/response model the api-docs components
// render – so the components never touch raw OpenAPI or $ref chasing.

export {
  fetchOpenApi,
  resolveOpenApiUrl,
  resolveServerOrigin,
} from './fetchOpenApi';
export { parseOpenApi } from './parseOpenApi';
export type {
  NormalizedApi,
  NormalizedEndpoint,
  NormalizedInfo,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
} from './types';
