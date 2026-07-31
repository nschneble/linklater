import { describe, expect, it } from 'vitest';
import { parseOpenApi } from './parseOpenApi';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * A trimmed-but-representative `/links` spec mirroring the shape NestJS
 * Swagger emits for `LinksController`: typed responses become `$ref`s into
 * `components.schemas`, list responses nest a `$ref` inside array `items`,
 * the create body is a referenced request-body schema, and query/path
 * parameters carry inline schemas.
 */
const SPEC: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Linklater API',
    description: 'Authorization: Bearer ltk_…',
    version: '0.3.0',
  },
  paths: {
    '/links': {
      get: {
        summary: 'List links',
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Full-text search.',
            schema: { type: 'string' },
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'One page of links.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedLinks' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Save a URL',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLink' },
            },
          },
        },
        responses: {
          '201': {
            description: 'The saved link.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Link' },
              },
            },
          },
          '400': { description: 'Invalid URL.' },
        },
      },
    },
    '/links/{id}': {
      get: {
        summary: 'Get a link by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'The link.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Link' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Link: {
        type: 'object',
        properties: { id: { type: 'string' }, url: { type: 'string' } },
      },
      PaginatedLinks: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Link' },
          },
          total: { type: 'integer' },
        },
      },
      CreateLink: {
        type: 'object',
        properties: { url: { type: 'string' } },
      },
    },
  },
};

describe('parseOpenApi', () => {
  it('mirrors top-level info', () => {
    const api = parseOpenApi(SPEC, 'https://api.test');
    expect(api.info).toEqual({
      title: 'Linklater API',
      description: 'Authorization: Bearer ltk_…',
      version: '0.3.0',
    });
  });

  it('carries the supplied server origin through', () => {
    const api = parseOpenApi(SPEC, 'https://api.test');
    expect(api.serverOrigin).toBe('https://api.test');
  });

  it('extracts one endpoint per method/path pair', () => {
    const api = parseOpenApi(SPEC, '');
    expect(api.endpoints).toHaveLength(3);
    expect(
      api.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
    ).toEqual(['get /links', 'get /links/{id}', 'post /links']);
  });

  it('orders endpoints by method (get,post,put,delete) then path', () => {
    const api = parseOpenApi(SPEC, '');
    const order = api.endpoints.map(
      (endpoint) => `${endpoint.method} ${endpoint.path}`,
    );
    // GETs precede POST; within GET, `/links` sorts before `/links/{id}`
    expect(order).toEqual(['get /links', 'get /links/{id}', 'post /links']);
  });

  it('normalizes query parameters with name, required, and schema', () => {
    const api = parseOpenApi(SPEC, '');
    const list = api.endpoints.find(
      (endpoint) => endpoint.method === 'get' && endpoint.path === '/links',
    );
    expect(list?.parameters).toEqual([
      {
        name: 'search',
        location: 'query',
        required: false,
        description: 'Full-text search.',
        schema: { type: 'string' },
      },
      {
        name: 'page',
        location: 'query',
        required: false,
        schema: { type: 'string' },
      },
    ]);
  });

  it('normalizes a path parameter as required', () => {
    const api = parseOpenApi(SPEC, '');
    const byId = api.endpoints.find(
      (endpoint) => endpoint.path === '/links/{id}',
    );
    expect(byId?.parameters[0]).toMatchObject({
      name: 'id',
      location: 'path',
      required: true,
    });
  });

  it('resolves the request body schema from its $ref', () => {
    const api = parseOpenApi(SPEC, '');
    const create = api.endpoints.find((endpoint) => endpoint.method === 'post');
    expect(create?.requestBody).toMatchObject({
      required: true,
      schema: { type: 'object', properties: { url: { type: 'string' } } },
    });
  });

  it('resolves response schemas keyed by status code, including nested refs', () => {
    const api = parseOpenApi(SPEC, '');
    const list = api.endpoints.find(
      (endpoint) => endpoint.method === 'get' && endpoint.path === '/links',
    );
    const success = list?.responses.find(
      (response) => response.statusCode === '200',
    );
    const data = success?.schema?.properties
      ?.data as OpenAPIV3.ArraySchemaObject;
    const items = data.items as OpenAPIV3.SchemaObject;
    expect(items.properties?.url).toEqual({ type: 'string' });
  });

  it('keeps a response with a description but no body schema', () => {
    const api = parseOpenApi(SPEC, '');
    const create = api.endpoints.find((endpoint) => endpoint.method === 'post');
    const badRequest = create?.responses.find(
      (response) => response.statusCode === '400',
    );
    expect(badRequest).toMatchObject({
      statusCode: '400',
      description: 'Invalid URL.',
    });
    expect(badRequest?.schema).toBeUndefined();
  });

  it('returns safe defaults for an empty spec', () => {
    const api = parseOpenApi({} as OpenAPIV3.Document, '');
    expect(api.endpoints).toEqual([]);
    expect(api.info).toEqual({ title: '', version: '' });
    expect(api.serverOrigin).toBe('');
  });

  it('tolerates a malformed spec with no paths object', () => {
    const malformed = {
      info: { title: 'X', version: '1' },
    } as OpenAPIV3.Document;
    const api = parseOpenApi(malformed, '');
    expect(api.endpoints).toEqual([]);
    expect(api.info).toEqual({ title: 'X', version: '1' });
  });
});
