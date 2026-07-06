import type { OpenAPIV3 } from 'openapi-types';

const LOCAL_SCHEMA_PREFIX = '#/components/schemas/';

type SchemaOrReference =
  | OpenAPIV3.SchemaObject
  | OpenAPIV3.ReferenceObject
  | undefined;

type SchemaMap = Record<string, OpenAPIV3.SchemaObject>;

function isReference(
  schema: SchemaOrReference,
): schema is OpenAPIV3.ReferenceObject {
  return schema !== undefined && '$ref' in schema;
}

/**
 * Reads the schema name out of a local component reference
 * (`#/components/schemas/Foo` → `Foo`). Returns `undefined` for external or
 * non-schema references, which this layer does not resolve – the served
 * Linklater spec only ever refs its own `components.schemas`.
 */
function schemaNameFromReference(reference: string): string | undefined {
  if (!reference.startsWith(LOCAL_SCHEMA_PREFIX)) return undefined;
  return reference.slice(LOCAL_SCHEMA_PREFIX.length);
}

/**
 * Recursively follows every `$ref` in a schema down to its target in
 * `components.schemas`, producing a self-contained schema with no
 * `ReferenceObject`s left in it. Single- and multi-member `allOf`
 * compositions are also flattened into one merged object schema (see
 * {@link flattenAllOf}), so downstream consumers — which understand plain
 * `type`/`properties` but not composition keywords — see a self-contained
 * object. This matters for `@nestjs/swagger`'s nullable typed-ref emission
 * (e.g. `LinkResponseDto.meta`), where a `$ref` is wrapped in `allOf`
 * alongside sibling `nullable`/`type: 'object'`/`description` keywords.
 *
 * Guards:
 * - A `$ref` whose target is missing (or external) resolves to `undefined`,
 *   so the caller can omit the schema rather than crash.
 * - A schema that refers back to a name already on the current resolution
 *   path (a cycle, e.g. a self-referential `next`) is left as a shallow
 *   placeholder – its own children are not recursed – so resolution always
 *   terminates.
 *
 * @param schema The schema or reference to resolve.
 * @param schemas The `components.schemas` map to resolve references against.
 * @param visited Schema names currently on the resolution path (cycle guard).
 */
export function resolveSchema(
  schema: SchemaOrReference,
  schemas: SchemaMap,
  visited: ReadonlySet<string> = new Set(),
): OpenAPIV3.SchemaObject | undefined {
  if (schema === undefined) return undefined;

  if (isReference(schema)) {
    const name = schemaNameFromReference(schema.$ref);
    if (name === undefined) return undefined;
    if (visited.has(name)) {
      // Cycle: hand back the raw target without recursing into it again.
      return schemas[name];
    }
    const target = schemas[name];
    if (target === undefined) return undefined;
    const nextVisited = new Set(visited);
    nextVisited.add(name);
    return resolveSchema(target, schemas, nextVisited);
  }

  return resolveSchemaChildren(schema, schemas, visited);
}

/**
 * Walks the resolvable child positions of an inline schema – `properties`,
 * array `items`, `additionalProperties`, and the `allOf`/`oneOf`/`anyOf`
 * composition keywords – replacing each with its resolved form.
 */
function resolveSchemaChildren(
  schema: OpenAPIV3.SchemaObject,
  schemas: SchemaMap,
  visited: ReadonlySet<string>,
): OpenAPIV3.SchemaObject {
  const resolved: OpenAPIV3.SchemaObject = { ...schema };

  if (schema.properties) {
    const properties: Record<string, OpenAPIV3.SchemaObject> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      const child = resolveSchema(value, schemas, visited);
      if (child !== undefined) properties[key] = child;
    }
    resolved.properties = properties;
  }

  if ('items' in schema && schema.items) {
    const items = resolveSchema(schema.items, schemas, visited);
    if (items !== undefined) {
      (resolved as OpenAPIV3.ArraySchemaObject).items = items;
    }
  }

  if (
    typeof schema.additionalProperties === 'object' &&
    schema.additionalProperties !== null
  ) {
    const additional = resolveSchema(
      schema.additionalProperties,
      schemas,
      visited,
    );
    if (additional !== undefined) resolved.additionalProperties = additional;
  }

  for (const keyword of ['allOf', 'oneOf', 'anyOf'] as const) {
    const members = schema[keyword];
    if (members) {
      resolved[keyword] = members
        .map((member) => resolveSchema(member, schemas, visited))
        .filter(
          (member): member is OpenAPIV3.SchemaObject => member !== undefined,
        );
    }
  }

  return flattenAllOf(resolved);
}

/**
 * Merges an `allOf` composition into its host schema so consumers see a single
 * plain object rather than a wrapper whose real shape hides one level down.
 *
 * `allOf` is an intersection, so this folds every (already-resolved) member's
 * `properties` and `required` into the host and pulls in any keyword the host
 * itself does not set. The host's own keywords win on conflict — its
 * property-level `description`, `nullable`, and `type` are the authoritative
 * ones. `oneOf`/`anyOf` are unions, not merges, so they are left untouched.
 *
 * The host keeps `nullable: true` where present, but flattening deliberately
 * does NOT collapse the schema to `null`: the docs render a value's *shape*, so
 * a nullable object must still expose its populated `properties`.
 */
function flattenAllOf(schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject {
  const members = schema.allOf as OpenAPIV3.SchemaObject[] | undefined;
  if (!members || members.length === 0) return schema;

  const merged: OpenAPIV3.SchemaObject = { ...schema };
  delete merged.allOf;
  const mergedProperties: Record<string, OpenAPIV3.SchemaObject> = {
    ...((schema.properties as Record<string, OpenAPIV3.SchemaObject>) ?? {}),
  };
  const mergedRequired = new Set(schema.required ?? []);

  for (const member of members) {
    for (const [key, value] of Object.entries(member)) {
      if (key === 'properties') {
        Object.assign(
          mergedProperties,
          value as Record<string, OpenAPIV3.SchemaObject>,
        );
      } else if (key === 'required') {
        for (const name of value as string[]) mergedRequired.add(name);
      } else if (!(key in merged)) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  if (Object.keys(mergedProperties).length > 0) {
    merged.properties = mergedProperties;
  }
  if (mergedRequired.size > 0) {
    merged.required = [...mergedRequired];
  }

  return merged;
}
