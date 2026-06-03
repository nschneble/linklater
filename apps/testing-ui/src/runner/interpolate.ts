/**
 * Expands `${name}` placeholders in a string from a parameter map. Throws when
 * a placeholder has no matching parameter so a typo in a story or action fails
 * loudly instead of silently leaving a literal `${url}` in a URL field.
 */
export function interpolate(
  template: string,
  parameters: Record<string, string>,
): string {
  return template.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_match, name: string) => {
    const value = parameters[name];
    if (value === undefined) {
      throw new Error(`Missing parameter "${name}" for template "${template}"`);
    }
    return value;
  });
}
