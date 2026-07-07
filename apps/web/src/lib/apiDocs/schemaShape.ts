import type { OpenAPIV3 } from 'openapi-types';

/**
 * Pure helpers that turn a resolved `OpenAPIV3.SchemaObject` into the flat,
 * row-shaped data the read-only `<SchemaTable>` renders. Kept UI-free and out
 * of `components/` so the type-formatting and nesting rules can be unit-tested
 * on their own; the component stays presentational.
 *
 * Schemas arriving here are already `$ref`-resolved and `allOf`-flattened (see
 * `lib/openapi`), so these helpers never follow references or unwrap a
 * composition — a nullable typed-ref property surfaces its `properties`
 * directly and expands as a normal nested object.
 */

/** Kind of nested rendering a property's schema calls for, if any. */
export type NestedShape =
  /** A nested object whose `properties` should render as a child table. */
  | { kind: 'object'; schema: OpenAPIV3.SchemaObject; label: string }
  /** An array whose item object should render as a child table. */
  | { kind: 'array'; schema: OpenAPIV3.SchemaObject; label: string }
  /** Too deep to expand this wave – render a text note instead. */
  | { kind: 'note' }
  /** A scalar (string/number/boolean/etc.) – no nesting. */
  | null;

/** One row of a `<SchemaTable>`: a single property of an object schema. */
export interface SchemaRow {
  name: string;
  typeLabel: string;
  required: boolean;
  description?: string;
  /** Present when the property's value is itself an object or array of objects. */
  nested: NestedShape;
}

/** Human-readable type label, e.g. `string`, `array`, `integer`. */
export function describeType(
  schema: OpenAPIV3.SchemaObject | undefined,
): string {
  if (!schema) return 'unknown';
  if (schema.enum) return 'enum';
  if (schema.type === 'array') {
    // Arrays render as a bare "array" – the item shape is conveyed by the
    // nested item table (see `describeNested`), not this compact type label.
    return 'array';
  }
  if (Array.isArray(schema.type)) return schema.type.join(' | ');
  return schema.type ?? 'object';
}

/** True when a schema is an object that exposes named `properties`. */
function isExpandableObject(
  schema: OpenAPIV3.SchemaObject | undefined,
): schema is OpenAPIV3.SchemaObject {
  return Boolean(
    schema &&
    schema.type === 'object' &&
    schema.properties &&
    Object.keys(schema.properties).length > 0,
  );
}

/**
 * Decides whether a property's schema should render as a nested child table.
 * Capped at one level deep this wave (CONSTRAINT T4): a nested object/array is
 * expanded once; anything deeper resolves to a `note` so the caller renders a
 * "nested object – see full schema" text note instead.
 *
 * @param schema The property's resolved schema.
 * @param depth How many levels of nesting have already been rendered.
 */
export function describeNested(
  schema: OpenAPIV3.SchemaObject | undefined,
  depth: number,
  name: string,
): NestedShape {
  if (!schema) return null;

  // Read the array's item schema up front so the later array branch does not
  // depend on `schema` being narrowed away by the object type guard above.
  const arrayItems =
    schema.type === 'array'
      ? (schema.items as OpenAPIV3.SchemaObject | undefined)
      : undefined;

  if (isExpandableObject(schema)) {
    if (depth >= 1) return { kind: 'note' };
    return { kind: 'object', schema, label: `${name} properties` };
  }

  if (isExpandableObject(arrayItems)) {
    if (depth >= 1) return { kind: 'note' };
    return {
      kind: 'array',
      schema: arrayItems,
      label: `${name}[] item properties`,
    };
  }

  return null;
}

/**
 * Flattens an object schema's `properties` into table rows, marking each row
 * required per the schema's `required` list. Returns an empty array for any
 * schema that is not an object with properties – the caller renders the
 * "No properties." fallback (CONSTRAINT T5).
 *
 * @param schema The resolved object schema to flatten.
 * @param depth Current nesting depth (0 at the top level).
 */
export function toSchemaRows(
  schema: OpenAPIV3.SchemaObject | undefined,
  depth = 0,
): SchemaRow[] {
  if (!isExpandableObject(schema)) return [];

  const requiredNames = new Set(schema.required ?? []);
  const properties = schema.properties as Record<
    string,
    OpenAPIV3.SchemaObject
  >;

  return Object.entries(properties).map(([name, propertySchema]) => {
    return {
      name,
      typeLabel: describeType(propertySchema),
      required: requiredNames.has(name),
      description: propertySchema.description,
      nested: describeNested(propertySchema, depth, name),
    };
  });
}
