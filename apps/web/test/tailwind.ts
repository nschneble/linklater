/**
 * Compiles utility classes through the real Tailwind pipeline.
 *
 * A test that only greps a `className` string proves the string is there,
 * not that Tailwind knows the variant in it. A variant the compiler does
 * not recognise emits nothing at all, so asking the compiler is what makes
 * the assertion falsifiable.
 *
 * Four suites had grown their own copy of this. They also all returned
 * `loadStylesheet` synchronously, which the runtime tolerates because the
 * caller awaits the result either way, but which is not what the type
 * says. One copy, declared the way the contract declares it.
 */

import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const requireFromHere = createRequire(import.meta.url);

/**
 * Resolves `@import "tailwindcss";` and its relative sub-imports off disk,
 * so the compiler registers the core variants and utilities rather than
 * only what the stylesheet names directly.
 */
async function loadStylesheet(id: string, base: string) {
  const path =
    id === 'tailwindcss'
      ? resolve(
          dirname(requireFromHere.resolve('tailwindcss/package.json')),
          'index.css',
        )
      : resolve(base, id);
  return { base: dirname(path), content: readFileSync(path, 'utf8'), path };
}

export async function compileClasses(classes: string[]): Promise<string> {
  const compiler = await compile('@import "tailwindcss";', {
    base: process.cwd(),
    loadStylesheet,
  });
  return compiler.build(classes);
}
