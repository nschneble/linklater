# Project Configuration

## Tech Stack

- **Front-end**: React + [Vite](https://vite.dev) + [Tailwind](https://tailwindcss.com) + [Font Awesome](https://fontawesome.com)
- **Back-end**: [NestJS](https://nestjs.com)
- **Database**: Prisma + PostgreSQL
- **Authentication**: [Passport](https://www.passportjs.org)
- **Linting**: ESLint + Prettier
- **Testing**: Vitest (front-end) + Jest (back-end)

## Architecture

```
apps
├─ api/          # NestJS back-end
├─ web/          # React + Vite front-end
├─ package.json  # root workspace + scripts
└─ README.md
```

## Key Commands

```bash
# Setup
npm install                              # Install dependencies

# Run
npm run dev                              # Start development server

# Linting
npm run lint                             # Lint code for consistent style
npm run lint --workspace @linklater/web  # Lint front-end only
npm run lint --workspace @linklater/api  # Lint back-end only

# Testing
npm run test                             # Run all tests
npm run test --workspace @linklater/web  # Test front-end only
npm run test --workspace @linklater/api  # Test back-end only

# Database
npx prisma migrate dev --name init       # Run migrations (first time)
npx prisma migrate dev                   # Run migrations
```

## Development Workflow

Use the [Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html) (TDD) technique.

Follow three simple steps repeatedly:

1. **RED:** Write a failing test describing the desired behavior
2. **GREEN:** Write minimal code to pass the test
3. **REFACTOR:** Improve code structure while keeping tests green

## Core Conventions

TBD

## Naming Conventions

| Layer | Pattern | Example |
| ----- | ------- | ------- |
| TBD   | TBD     | TBD     |
