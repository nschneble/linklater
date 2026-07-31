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

  it('flattens an allOf composition into one merged object schema', () => {
    const resolved = resolveSchema(
      {
        allOf: [
          { $ref: '#/components/schemas/Link' },
          { type: 'object', properties: { extra: { type: 'boolean' } } },
        ],
      },
      schemas,
    );
    // allOf members merge into the parent, so consumers see one flat object
    expect(resolved?.allOf).toBeUndefined();
    expect(resolved).toMatchObject({ type: 'object' });
    expect(resolved?.properties?.id).toEqual({ type: 'string' });
    expect(resolved?.properties?.url).toEqual({ type: 'string' });
    expect(resolved?.properties?.extra).toEqual({ type: 'boolean' });
  });

  it('flattens a NestJS nullable typed-ref property (allOf + sibling nullable/type)', () => {
    // @nestjs/swagger wraps a typed-ref in allOf: a $ref can't carry siblings
    const resolved = resolveSchema(
      {
        nullable: true,
        type: 'object',
        description:
          'Extracted metadata. Null until the fetch worker completes.',
        allOf: [{ $ref: '#/components/schemas/Link' }],
      } as OpenAPIV3.SchemaObject,
      schemas,
    );
    expect(resolved?.allOf).toBeUndefined();
    // the referenced object's properties surface on the merged schema
    expect(resolved?.properties?.id).toEqual({ type: 'string' });
    expect(resolved?.properties?.url).toEqual({ type: 'string' });
    // nullable: true must NOT collapse it to scalar/null - stays an object
    expect(resolved).toMatchObject({ type: 'object', nullable: true });
    expect(resolved?.description).toBe(
      'Extracted metadata. Null until the fetch worker completes.',
    );
  });

  it('keeps the wrapper property-level description over the referenced schema description', () => {
    const withDescriptions: Record<string, OpenAPIV3.SchemaObject> = {
      Inner: {
        type: 'object',
        description: 'inner description',
        properties: { value: { type: 'string' } },
      },
    };
    const resolved = resolveSchema(
      {
        description: 'wrapper description',
        allOf: [{ $ref: '#/components/schemas/Inner' }],
      } as OpenAPIV3.SchemaObject,
      withDescriptions,
    );
    expect(resolved?.description).toBe('wrapper description');
    expect(resolved?.properties?.value).toEqual({ type: 'string' });
  });

  it('unions the required lists of the wrapper and its allOf members', () => {
    const resolved = resolveSchema(
      {
        type: 'object',
        required: ['own'],
        properties: { own: { type: 'string' } },
        allOf: [
          {
            type: 'object',
            required: ['merged'],
            properties: { merged: { type: 'string' } },
          },
        ],
      } as OpenAPIV3.SchemaObject,
      schemas,
    );
    expect(resolved?.allOf).toBeUndefined();
    expect(new Set(resolved?.required)).toEqual(new Set(['own', 'merged']));
    expect(resolved?.properties?.own).toBeDefined();
    expect(resolved?.properties?.merged).toBeDefined();
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
    // the dangling member resolves to undefined and is dropped from the union
    const members = resolved?.oneOf as OpenAPIV3.SchemaObject[];
    expect(members).toHaveLength(1);
    expect(members[0].properties?.url).toEqual({ type: 'string' });
  });

  it('guards against a self-referential (cyclic) schema', () => {
    const resolved = resolveSchema(
      { $ref: '#/components/schemas/Node' },
      schemas,
    );
    // first level resolves; cyclic `next` left shallow, not recursed forever
    expect(resolved).toMatchObject({ type: 'object' });
    expect(resolved?.properties?.value).toEqual({ type: 'string' });
    expect(resolved?.properties?.next).toBeDefined();
  });

  it('returns undefined when given undefined', () => {
    expect(resolveSchema(undefined, schemas)).toBeUndefined();
  });
});
