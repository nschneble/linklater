import type { OpenAPIV3 } from 'openapi-types';

/**
 * Derives a minimal, editable example value from a resolved OpenAPI schema so
 * the "try it out" request-body editor can prefill a sensible JSON skeleton
 * the user only has to tweak rather than author from scratch.
 *
 * Schemas arriving here are already `$ref`-resolved (see `lib/openapi`), so
 * this never follows references. Resolution order per node:
 *   1. an explicit `example` on the schema (most authoritative),
 *   2. the first `enum` member,
 *   3. a type-derived placeholder (`''`, `0`, `false`, `[item]`, `{}`).
 *
 * Capped implicitly by the spec's own nesting – objects recurse into their
 * properties and arrays into a single representative item.
 */
export function buildExampleFromSchema(
  schema: OpenAPIV3.SchemaObject | undefined,
): unknown {
  if (!schema) return {};

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema.type === 'array') {
    const items = schema.items as OpenAPIV3.SchemaObject | undefined;
    return [buildExampleFromSchema(items)];
  }

  if (schema.type === 'object' || schema.properties) {
    const properties = (schema.properties ?? {}) as Record<
      string,
      OpenAPIV3.SchemaObject
    >;
    const example: Record<string, unknown> = {};
    for (const [name, propertySchema] of Object.entries(properties)) {
      example[name] = buildExampleFromSchema(propertySchema);
    }
    return example;
  }

  return placeholderForScalar(schema.type);
}

/** Type-appropriate empty placeholder for a scalar schema node. */
function placeholderForScalar(
  type: OpenAPIV3.NonArraySchemaObjectType | undefined,
): unknown {
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return false;
  return '';
}
