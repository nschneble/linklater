# Project

## Description

Linklater is an Instapaper-inspired "read it later" app.

## Stack

- **Back-end:** NestJS, [Passport] (auth), [pg-boss] (jobs)
- **Database:** PostgreSQL, Prisma
- **Front-end:** Font Awesome, React, Tailwind, Vite
- **Linting:** ESLint, Prettier
- **Testing:** Jest, [Tuffgal], Vitest

## Commands

- **Build:** `npm run build`
- **Format:** `npm run format`
- **Lint:** `npm run lint`
- **Lint Migrations:** `npm run lint:migrations`
- **Lint Shell:** `npm run lint:shell`
- **Migrate:** `npm run migrate --workspace @linklater/api`
- **Reset Database:** `npm run migrate:reset --workspace @linklater/api`
- **Run:** `npm run dev`
- **Test:** `npm run test`
- **Test Coverage:** `npm run test:cov`
- **Tuffgal Setup:** `npm run tuffgal:setup`
- **Tuffgal:** `npm run tuffgal`, `npm run dev:test`
- **Typecheck:** `npm run typecheck`

## Rules

- Always delegate business logic to services (none in controllers or views)
- Always kill listeners and temp processes
- Always use the latest stable version when installing new packages
- Avoid shortened and single-character variable names (e.g. `i` or `obj`)
- Avoid state-driven styling in place of Tailwind variants
- Check installed versions before suggesting tools or syntax
- Don't allow god files to persist (refactor files with 100+ lines of code)
- Don't prematurely optimize
- Embrace Postel's Law: be conservative in output, liberal in input
- Lean database calls (avoid excess joins and n+1 queries)
- Normalize user input before matching/comparing
- Organize code into modules
- Prefer free and open-source software for packages and suggestions
- Prefer Tuffgal stories over unit and integration tests
- Respect React naming conventions (e.g. use `props`, not `attributes`)
- Services throw NestJS HTTP exceptions (e.g. `NotFoundException`)
- Sort imports alphabetically by the first identifier each import binds
- Stay DRY, but not barren (extract common code when used 3+ times)
- Use self-explanatory folder, file, method, and variable names
- Use Test Driven Development (RED, GREEN, REFACTOR)

## Verify

After any changes, format/lint/typecheck/build and run tests. Ensure
everything passes.

[Passport]: https://www.passportjs.org
[pg-boss]: https://pgboss.io
[Tuffgal]: https://github.com/nschneble/tuffgal
