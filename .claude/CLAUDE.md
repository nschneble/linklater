# Project

## Description

Linklater is an Instapaper-inspired "read it later" app. It’s both an
homage to Richard Linklater and a ridiculously apt portmanteau.

Most curious adults come across dozens of interesting articles on any given
day, but they're busy and often forget about them. Linklater allows these
articles to be saved quickly and easily for later reading.

# Tech stack

- **Back-end:** NestJS, [Passport], [pg-boss]
- **Database:** PostgreSQL, Prisma
- **Front-end:** Font Awesome, React, Tailwind, Vite
- **Linting:** ESLint, Prettier
- **Testing:** Jest, [Tuffgal], Vitest

# Commands

- **Format:** `npm run format`
- **Lint:** `npm run lint{,:migrations,:shell}`
- **Migrate:** `npm run migrate{,:reset} --workspace @linklater/api`
- **Run:** `npm run dev`
- **Test:** `npm run test{,:cov}`
- **Tuffgal:** `npm run tuffgal{,:setup}`, `npm run dev:test`
- **Typecheck:** `npm run typecheck`

# Rules

- Always use the latest stable version when installing new packages
- Check installed versions before suggesting tools or syntax
- Consider [response time limits] (0.1s, 1.0s, 10s)
- Embrace Postel's Law: be conservative in output, liberal in input
- Lean database calls (avoid excess joins and n+1 queries)
- [Make interfaces feel better]
- Normalize user input before matching/comparing
- Organize code into modules
- Prefer free and open-source software
- Prefer Tuffgal stories over unit and integration tests
- Services throw NestJS HTTP exceptions (e.g. `NotFoundException`)
- Sort imports alphabetically by the first identifier each import binds
- Stay DRY, but not barren (extract common code when used 3+ times)
- Use self-explanatory folder, file, method, and variable names
- Use Test Driven Development (RED, GREEN, REFACTOR)

# Never should you ever…

- Allow god files to persist (refactor files with 100+ lines of code)
- Leave listeners or temporary processes running
- Prematurely optimize
- Put business logic in controllers or views (delegate 100% to services)
- Replace React conventions (e.g. use `props`, not `attributes`)
- Use shortened or single-character variable names (e.g. `i` or `obj`)
- Use state-driven styling in place of Tailwind variants

# Trust, but verify

After any changes, format/lint/typecheck and run tests. Ensure everything
passes.

[Make interfaces feel better]: https://jakub.kr/writing/details-that-make-interfaces-feel-better
[Passport]: https://www.passportjs.org
[pg-boss]: https://pgboss.io
[response time limits]: https://www.nngroup.com/articles/response-times-3-important-limits
[Tuffgal]: https://github.com/nschneble/tuffgal
