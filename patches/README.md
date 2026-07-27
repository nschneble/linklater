# Patches

Applied by `patch-package` from the root `postinstall` script.

## brace-expansion+5.0.8.patch

Works around [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg)
(CVE-2026-14257, out-of-memory DoS in `brace-expansion`). The only patched
release is `5.0.8` and no `1.x`/`2.x` backports exist, so the root override
`"brace-expansion@<5.0.8": "5.0.8"` forces every copy onto it. But v1/v2
consumers (`minimatch` 3.x/9.x, pulled in by eslint 9, jest 30,
`@nestjs/cli`, `eslint-plugin-react`, and `eslint-plugin-jsx-a11y`) call
the module itself as a function, while v5 only exports `{ expand }`. The
patch restores the legacy callable shape (CommonJS `module.exports` + ESM
default export) on top of the patched implementation, keeping the named
exports for v5 consumers like `minimatch` 10.x.

### Remove when

Upstream publishes patched `brace-expansion@1.x`/`2.x` backports, or every
consumer chain reaches `minimatch >= 10.2.5` (eslint 10 +
eslint-plugin-react / eslint-plugin-jsx-a11y releases that support it +
jest on glob 13). Then delete the patch, the override, and the
`postinstall` script.
