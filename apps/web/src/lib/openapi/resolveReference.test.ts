import { describe, expect, it } from 'vitest';
import { resolveSchema } from './resolveReference';
import type { OpenAPIV3 } from 'openapi-types';

describe('resolveSchema', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Link: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
      },
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
    Node: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        next: { $ref: '#/components/schemas/Node' },
      },
    },
  };

  it('returns a plain inline schema unchanged', () => {
    const schema: OpenAPIV3.SchemaObject = { type: 'string' };
    expect(resolveSchema(schema, schemas)).toEqual({ type: 'string' });
  });

  it('follows a top-level $ref to its target schema', () => {
    const resolved = resolveSchema(
      { $ref: '#/components/schemas/Link' },
      schemas,
    );
    expect(resolved).toMatchObject({
      type: 'object',
      properties: { id: { type: 'string' }, url: { type: 'string' } },
    });
  });

  it('resolves a $ref nested inside an array items schema', () => {
    const resolved = resolveSchema(
      { $ref: '#/components/schemas/PaginatedLinks' },
      schemas,
    );
    const data = resolved?.properties?.data as OpenAPIV3.ArraySchemaObject;
    const items = data.items as OpenAPIV3.SchemaObject;
    expect(items).toMatchObject({ type: 'object' });
    expect(items.properties?.url).toEqual({ type: 'string' });
  });

  it('returns undefined for a $ref with no matching target', () => {
    const resolved = resolveSchema(
      { $ref: '#/components/schemas/DoesNotExist' },
      schemas,
    );
    expect(resolved).toBeUndefined();
  });

  it('returns undefined for an external (non-local) $ref', () => {
    const resolved = resolveSchema(
      { $ref: 'https://example.test/other.json#/Foo' },
      schemas,
    );
    expect(resolved).toBeUndefined();
  });

  it('resolves a $ref inside additionalProperties (map-valued schema)', () => {
    const resolved = resolveSchema(
      {
        type: 'object',
        additionalProperties: { $ref: '#/components/schemas/Link' },
      },
      schemas,
    );
    const additional = resolved?.additionalProperties as OpenAPIV3.SchemaObject;
    expect(additional).toMatchObject({ type: 'object' });
    expect(additional.properties?.url).toEqual({ type: 'string' });
  });

  it('leaves a boolean additionalProperties untouched', () => {
    const resolved = resolveSchema(
      { type: 'object', additionalProperties: true },
      schemas,
    );
    expect(resolved?.additionalProperties).toBe(true);
  });

  it('resolves every member $ref inside an allOf composition', () => {
    const resolved = resolveSchema(
      {
        allOf: [
          { $ref: '#/components/schemas/Link' },
          { type: 'object', properties: { extra: { type: 'boolean' } } },
        ],
      },
      schemas,
    );
    const members = resolved?.allOf as OpenAPIV3.SchemaObject[];
    expect(members).toHaveLength(2);
    expect(members[0].properties?.url).toEqual({ type: 'string' });
    expect(members[1].properties?.extra).toEqual({ type: 'boolean' });
  });

  it('drops unresolvable members from a oneOf composition', () => {
    const resolved = resolveSchema(
      {
        oneOf: [
          { $ref: '#/components/schemas/Link' },
          { $ref: '#/components/schemas/DoesNotExist' },
        ],
      },
      schemas,
    );
    // The dangling member resolves to undefined and is filtered out rather
    // than leaving a hole in the union.
    const members = resolved?.oneOf as OpenAPIV3.SchemaObject[];
    expect(members).toHaveLength(1);
    expect(members[0].properties?.url).toEqual({ type: 'string' });
  });

  it('guards against a self-referential (cyclic) schema', () => {
    const resolved = resolveSchema(
      { $ref: '#/components/schemas/Node' },
      schemas,
    );
    // The first level resolves; the cyclic `next` is left as a shallow,
    // non-recursed placeholder rather than recursing forever.
    expect(resolved).toMatchObject({ type: 'object' });
    expect(resolved?.properties?.value).toEqual({ type: 'string' });
    expect(resolved?.properties?.next).toBeDefined();
  });

  it('returns undefined when given undefined', () => {
    expect(resolveSchema(undefined, schemas)).toBeUndefined();
  });
});
