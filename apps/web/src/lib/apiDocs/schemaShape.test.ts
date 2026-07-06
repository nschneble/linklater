import { describeType, toSchemaRows } from './schemaShape';
import { resolveSchema } from '../openapi/resolveReference';
import { describe, expect, it } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

describe('describeType', () => {
  it('labels scalars by their JSON Schema type', () => {
    expect(describeType({ type: 'string' })).toBe('string');
    expect(describeType({ type: 'integer' })).toBe('integer');
  });

  it('labels arrays by their item type', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'array',
      items: { type: 'string' },
    };
    expect(describeType(schema)).toBe('array of string');
  });

  it('falls back to unknown for a missing schema', () => {
    expect(describeType(undefined)).toBe('unknown');
  });

  it('labels an enum schema as enum regardless of its base type', () => {
    expect(describeType({ type: 'string', enum: ['a', 'b'] })).toBe('enum');
  });

  it('joins a union type array with a pipe', () => {
    const schema = {
      type: ['string', 'null'],
    } as unknown as OpenAPIV3.SchemaObject;
    expect(describeType(schema)).toBe('string | null');
  });

  it('falls back to object for a typeless schema', () => {
    expect(describeType({})).toBe('object');
  });
});

describe('toSchemaRows', () => {
  it('flattens object properties and marks required from the required list', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        title: { type: 'string' },
      },
    };

    const rows = toSchemaRows(schema);
    expect(rows).toHaveLength(2);

    const urlRow = rows.find((row) => row.name === 'url');
    expect(urlRow?.required).toBe(true);

    const titleRow = rows.find((row) => row.name === 'title');
    expect(titleRow?.required).toBe(false);
  });

  it('returns an empty array for a non-object schema (drives the fallback)', () => {
    expect(toSchemaRows({ type: 'string' })).toEqual([]);
    expect(toSchemaRows(undefined)).toEqual([]);
  });

  it('expands a nested object one level deep', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: { source: { type: 'string' } },
        },
      },
    };

    const [row] = toSchemaRows(schema);
    expect(row.nested).toMatchObject({
      kind: 'object',
      label: 'metadata properties',
    });
  });

  it('expands an array-of-object as a nested item table', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };

    const [row] = toSchemaRows(schema);
    expect(row.nested).toMatchObject({
      kind: 'array',
      label: 'tags[] item properties',
    });
  });

  it('caps nesting at one level – deeper objects become a note (T4)', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        deeper: { type: 'object', properties: { leaf: { type: 'string' } } },
      },
    };

    // At depth 1, an expandable object resolves to a note rather than a table.
    const [row] = toSchemaRows(schema, 1);
    expect(row.nested).toEqual({ kind: 'note' });
  });

  it('caps an array-of-object at one level – deeper becomes a note (T4)', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };

    // At depth 1, an expandable array-of-object also collapses to a note
    // rather than recursing into a second nested table.
    const [row] = toSchemaRows(schema, 1);
    expect(row.nested).toEqual({ kind: 'note' });
  });

  it('expands a nullable typed-ref property once the resolver flattens it', () => {
    // The `meta` property arrives from @nestjs/swagger as a nullable typed-ref
    // (`allOf`-wrapped). Before the resolver flattened `allOf`, its `type:
    // 'object'` had no `properties`, so it rendered as a bare scalar row with
    // no nested table. Post-flatten it expands like any other nested object.
    const schemas: Record<string, OpenAPIV3.SchemaObject> = {
      Meta: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', nullable: true },
        },
      },
    };
    const resolved = resolveSchema(
      {
        type: 'object',
        properties: {
          meta: {
            nullable: true,
            type: 'object',
            description: 'Extracted metadata.',
            allOf: [{ $ref: '#/components/schemas/Meta' }],
          },
        },
      } as OpenAPIV3.SchemaObject,
      schemas,
    );

    const [metaRow] = toSchemaRows(resolved);
    expect(metaRow.name).toBe('meta');
    expect(metaRow.typeLabel).toBe('object');
    expect(metaRow.nested).toMatchObject({
      kind: 'object',
      label: 'meta properties',
    });
    const nestedSchema = (
      metaRow.nested as { kind: 'object'; schema: OpenAPIV3.SchemaObject }
    ).schema;
    expect(Object.keys(nestedSchema.properties ?? {})).toEqual(['id', 'title']);
  });
});
