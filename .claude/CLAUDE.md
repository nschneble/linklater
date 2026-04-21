# Project Configuration

## Tech Stack

- **Front-end**: React + [Vite](https://vite.dev) + [Tailwind](https://tailwindcss.com) + [Font Awesome](https://fontawesome.com)
- **Back-end**: [NestJS](https://nestjs.com)
- **Database**: Prisma + PostgreSQL
- **Authentication**: [Passport](https://www.passportjs.org)
- **Jobs:** [pg-boss](https://timgit.github.io/pg-boss/#/)
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
npx prisma migrate reset                 # Wipe and re-run all migrations
npx prisma generate                      # Regenerate client after migrations
```

> **Note:** Run `npx prisma generate` after any migration. The custom client output path in this project prevents `migrate dev` from triggering it automatically.

## Development Workflow

Use the [Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html) (TDD) technique.

Follow three simple steps repeatedly:

1. **RED:** Write a failing test describing the desired behavior
2. **GREEN:** Write minimal code to pass the test
3. **REFACTOR:** Improve code structure while keeping tests green

## Core Conventions

- Always organize code into modules
  - Refer to [Organizing Your React App Into Modules](https://dev.to/jack/organizing-your-react-app-into-modules-d6n) for examples
- Use self-explanatory folder, file, method, and variable names
  - Keep React conventions like `prop` and `props`
  - Never, ever use one-character variables (e.g. `e` or `i`)
  - Common shortenings to avoid:

  | Avoid             | Use instead               |
  | ----------------- | ------------------------- |
  | `arg`, `args`     | `argument`, `arguments`   |
  | `arr`             | `array`                   |
  | `btn`             | `button`                  |
  | `cb`              | `callback`                |
  | `ctx`             | `context`                 |
  | `e`, `err`        | `error`                   |
  | `e`, `evt`        | `event`                   |
  | `el`, `elem`      | `element`                 |
  | `fn`              | `function`                |
  | `idx`             | `index`                   |
  | `msg`             | `message`                 |
  | `num`             | `number`                  |
  | `obj`             | `object`                  |
  | `param`, `params` | `parameter`, `parameters` |
  | `ref`             | `reference`               |
  | `req`             | `request`                 |
  | `res`             | `response`                |
  | `str`             | `string`                  |
  | `sub`             | `subject`                 |
  | `tmp`             | `temp`                    |
  | `val`             | `value`                   |

- Favor code clarity over "perfect" optimization
  - Use full `if` statements instead of one-liners with ternary operators
- Stay DRY (but not barren)
  - Extract common code into something reusable when it's used more than twice
- Avoid complex monoliths or "god" files
  - Look for ways to refactor files over 100 lines
- Don't optimize prematurely
  - Don't worry if the homepage takes 1-2 seconds to load
  - Do worry if the homepage load time increases exponentially based on link count
- Keep database calls lean
  - Avoid too many joins
  - Avoid n+1 queries
- Keep in mind the three important response time limits
  - 0.1 second is the limit for having the user feel that the app is reacting instantaneously
  - 1.0 second is the limit for the user's flow of thought to stay uninterrupted
  - No special feedback is necessary during delays of more than 0.1 but less than 1.0 second
  - 10 seconds is about the limit for keeping the user's attention focused on the dialogue
  - For longer delays, users should be given feedback indicating when the app expects to be done
  - Refer to [Response Time Limits](https://www.nngroup.com/articles/response-times-3-important-limits/) for more information
- Always incorporate details that make user interfaces feel better
  - Refer to [Details That Make Interfaces Feel Better](https://jakub.kr/writing/details-that-make-interfaces-feel-better) for examples
- Embrace the slow software movement
  - Refer to [Slow Software Movement](https://codeberg.org/jaredwhite/slow-software) for a manifesto

## Tailwind Styling

- Favor adding Tailwind CSS styles in this order:
  - layouts (flex, block, relative, absolute)
  - sizes (w, max-w, h, max-h)
  - margins (mx, my)
  - paddings (px, py)
  - borders (border, border-color)
  - backgrounds (bg, bg-color)
  - text (text-color, text-size)
  - fonts (font-weight)
  - focus/outline/ring
  - rounded borders (rounded, rounded-size)
  - shadows (shadow, shadow-size)
  - transitions
  - pointers (cursor-pointer)
- Always start with layouts
- Always widths before heights
- Always x before y
- Always margins before padding
- Always backgrounds before borders before text
- Always colors before sizes
- Always end with transitions
- Always primary before states (border, hover:border, focus:border)
- Always primary before sizes (mx-auto, sm:mx-0)
