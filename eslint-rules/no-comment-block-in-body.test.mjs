/**
 * Tests for the local `no-comment-block-in-body` ESLint rule.
 *
 * `eslint-rules/` lives at the repo root, outside both workspace test runners
 * (Jest for the API, Vitest for the web app), so this spec runs on Node's
 * built-in test runner and is wired into `scripts/run-tests.mjs` so it executes
 * on every `npm run test`. Cases are named rather than titled by their source,
 * because a rule about comment layout needs multi-line fixtures and those make
 * unreadable test titles.
 *
 * The directive cases carry the most weight: a tooling directive with a note
 * above it is a real shape in this repo (the mount-only note in
 * `useFlashQueryParameters`), and flagging it would make the rule a nuisance.
 */

import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './no-comment-block-in-body.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  // stubbed so the suppression named in the flash-parameter fixture
  // resolves; RuleTester rejects a directive for an unknown rule, and
  // the fixture is only worth keeping if it names the real one
  plugins: {
    'react-hooks': { rules: { 'exhaustive-deps': { create: () => ({}) } } },
  },
});

ruleTester.run('no-comment-block-in-body', rule, {
  valid: [
    {
      name: 'a single line comment inside a function body',
      code: [
        'function handle() {',
        '  // the upstream response arrives unsorted',
        '  return sort(load());',
        '}',
      ].join('\n'),
    },
    {
      name: 'two line comments in a body separated by a blank line',
      code: [
        'function handle() {',
        '  // the upstream response arrives unsorted',
        '',
        '  // callers expect newest first',
        '  return sort(load());',
        '}',
      ].join('\n'),
    },
    {
      name: 'two line comments in a body separated by a statement',
      code: [
        'function handle() {',
        '  // the upstream response arrives unsorted',
        '  const rows = load();',
        '  // callers expect newest first',
        '  return sort(rows);',
        '}',
      ].join('\n'),
    },
    {
      name: 'a run at module scope',
      code: [
        '// module overviews are allowed to run long',
        '// this one does',
        'export const limit = 10;',
      ].join('\n'),
    },
    {
      name: 'a run inside a class body but outside any method',
      code: [
        'class Store {',
        '  // the cache is warmed by the module init hook',
        '  // never in the constructor',
        '  cache = new Map();',
        '}',
      ].join('\n'),
    },
    {
      name: 'a run inside an object literal at module scope',
      code: [
        'export const QUEUES = {',
        '  // adding a name here without a worker leaves a dead queue',
        '  // see the metadata service for the shape to follow',
        "  METADATA_FETCH: 'metadata-fetch',",
        '};',
      ].join('\n'),
    },
    {
      name: 'a JSDoc block above a function',
      code: [
        '/**',
        ' * Parses an opaque hex color to its channels.',
        ' * Rejects the alpha form, which has no luminance of its own.',
        ' */',
        'function hexToRgb(hex) {',
        '  return parse(hex);',
        '}',
      ].join('\n'),
    },
    {
      name: 'a comment trailing code does not start a run with the line below',
      code: [
        'function handle() {',
        '  const rows = load(); // unsorted upstream',
        '  // callers expect newest first',
        '  return sort(rows);',
        '}',
      ].join('\n'),
    },
    {
      name: 'the useFlashQueryParameters shape: a note above eslint-disable-next-line',
      code: [
        'function useFlashQueryParameters(read) {',
        '  useEffect(() => {',
        '    read();',
        '    // mount-only by design; see above',
        '    // eslint-disable-next-line react-hooks/exhaustive-deps',
        '  }, []);',
        '}',
      ].join('\n'),
    },
    {
      name: 'a note above a ts-expect-error',
      code: [
        'function handle() {',
        '  // the vendor types lag the runtime shape by a major version',
        '  // @ts-expect-error',
        '  return vendor.load();',
        '}',
      ].join('\n'),
    },
    {
      name: 'two adjacent directives with no prose between them',
      code: [
        'function handle() {',
        '  // eslint-disable-next-line no-console',
        '  // prettier-ignore',
        '  console.log(   load()   );',
        '}',
      ].join('\n'),
    },
    {
      name: 'a directive between two prose comments leaves neither adjacent',
      code: [
        'function handle() {',
        '  // the vendor types lag the runtime shape',
        '  // @ts-expect-error',
        '  // the call itself is safe at runtime',
        '  return vendor.load();',
        '}',
      ].join('\n'),
    },
  ],
  invalid: [
    {
      name: 'two adjacent prose comments in a function declaration body',
      code: [
        'function handle() {',
        '  // the upstream response arrives unsorted',
        '  // callers expect newest first',
        '  return sort(load());',
        '}',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'three adjacent prose comments in an arrow function body',
      code: [
        'const handle = () => {',
        '  // the upstream response arrives unsorted',
        '  // callers expect newest first',
        '  // and the sort has to be stable',
        '  return sort(load());',
        '};',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'two adjacent prose comments in a concise arrow body',
      code: [
        'const handle = () => (',
        '  // the upstream response arrives unsorted',
        '  // callers expect newest first',
        '  sort(load())',
        ');',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'two adjacent prose comments inside a class method',
      code: [
        'class Store {',
        '  load() {',
        '    // the cache is warmed by the module init hook',
        '    // a cold read here means the hook did not run',
        '    return this.cache.get(key);',
        '  }',
        '}',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'two adjacent prose comments inside an object method',
      code: [
        'export const store = {',
        '  load() {',
        '    // the cache is warmed by the module init hook',
        '    // a cold read here means the hook did not run',
        '    return cache.get(key);',
        '  },',
        '};',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'two adjacent prose comments inside a getter',
      code: [
        'class Store {',
        '  get size() {',
        '    // the map holds tombstones until the next prune',
        '    // so its raw size overcounts',
        '    return this.cache.size;',
        '  }',
        '}',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'two adjacent prose comments inside a callback passed to a call',
      code: [
        'rows.map((row) => {',
        '  // the upstream response arrives unsorted',
        '  // callers expect newest first',
        '  return decorate(row);',
        '});',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'a directive at the end of a run leaves two prose comments adjacent',
      code: [
        'function handle() {',
        '  // the vendor types lag the runtime shape',
        '  // the call itself is safe at runtime',
        '  // @ts-expect-error',
        '  return vendor.load();',
        '}',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody' }],
    },
    {
      name: 'a run of four reports once, on its first line',
      code: [
        'function handle() {',
        '  // one',
        '  // two',
        '  // three',
        '  // four',
        '  return load();',
        '}',
      ].join('\n'),
      errors: [{ messageId: 'commentBlockInBody', line: 2, column: 3 }],
    },
  ],
});
