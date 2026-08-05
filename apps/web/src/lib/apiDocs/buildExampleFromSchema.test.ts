import { buildExampleFromSchema } from './buildExampleFromSchema';
import { describe, expect, it } from 'vitest';
import { resolveSchema } from '../openapi/resolveReference';
import type { OpenAPIV3 } from 'openapi-types';

describe('buildExampleFromSchema', () => {
  it('prefers an explicit schema-level example when present', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      example: { url: 'https://example.com' },
    };
    expect(buildExampleFromSchema(schema)).toEqual({
      url: 'https://example.com',
    });
  });

  it('builds an object skeleton from properties', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        url: { type: 'string' },
        clicks: { type: 'integer' },
        archived: { type: 'boolean' },
      },
    };
    expect(buildExampleFromSchema(schema)).toEqual({
      url: '',
      clicks: 0,
      archived: false,
    });
  });

  it('uses a property-level example over a derived placeholder', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://linklater.dev' },
      },
    };
    expect(buildExampleFromSchema(schema)).toEqual({
      url: 'https://linklater.dev',
    });
  });

  it('uses the first enum value for an enum property', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'archived'] },
      },
    };
    expect(buildExampleFromSchema(schema)).toEqual({ status: 'active' });
  });

  it('builds a single-element array skeleton from its item schema', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' } } },
    };
    expect(buildExampleFromSchema(schema)).toEqual([{ id: '' }]);
  });

  it('returns an empty object for an object schema without properties', () => {
    const schema: OpenAPIV3.SchemaObject = { type: 'object' };
    expect(buildExampleFromSchema(schema)).toEqual({});
  });

  it('returns an empty object for an undefined schema', () => {
    expect(buildExampleFromSchema(undefined)).toEqual({});
  });

  // regression: builder has no allOf handling; resolver flattens nullable typed-refs first
  describe('nullable typed-ref property (allOf-wrapped) via the resolver', () => {
    const schemas: Record<string, OpenAPIV3.SchemaObject> = {
      Meta: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clz1abc123' },
          title: { type: 'string', example: 'Example Domain', nullable: true },
          fetchedAt: {
            type: 'string',
            example: '2026-05-27T12:00:00.000Z',
            nullable: true,
          },
        },
      },
    };
    // exactly the shape @nestjs/swagger emits (see schema-object-factory)
    const nullableTypedReference = {
      nullable: true,
      type: 'object',
      description: 'Extracted metadata. Null until the fetch worker completes.',
      allOf: [{ $ref: '#/components/schemas/Meta' }],
    } as OpenAPIV3.SchemaObject;

    it('renders the fully-populated object once the resolver flattens it', () => {
      const resolved = resolveSchema(nullableTypedReference, schemas);
      expect(buildExampleFromSchema(resolved)).toEqual({
        id: 'clz1abc123',
        title: 'Example Domain',
        fetchedAt: '2026-05-27T12:00:00.000Z',
      });
    });

    it('renders a populated object, not null, despite nullable: true', () => {
      const resolved = resolveSchema(nullableTypedReference, schemas);
      const example = buildExampleFromSchema(resolved);
      expect(example).not.toBeNull();
      expect(example).toMatchObject({ id: 'clz1abc123' });
    });
  });
});
