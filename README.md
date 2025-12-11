# Linklater

Linklater is a tiny [Instapaper](https://www.instapaper.com)-style “read it later” app built as a take-home assignment for a job interview.

It’s both an homage to [Richard Linklater](https://en.wikipedia.org/wiki/Richard_Linklater) and a ridiculously apt portmanteau.

## Features

- Sign up for an account with an email and password
- Save links to read later
- Search through your links to find something to read
- Archive links you’ve managed to read
- Delete links you can no longer stand the sight of
- StumbleUpon a random saved link
- Toggle between light and dark mode
- Use a [bookmarklet](#bookmarklet) to save links
- Delete your account and burn it to the ground

## Tech Stack

- **Front-end**: React + [Vite](https://vite.dev) + [Tailwind CSS](https://tailwindcss.com) + [Font Awesome](https://fontawesome.com)
- **Back-end**: [NestJS](https://nestjs.com)
- **Database**: Prisma + PostgreSQL
- **Authentication**: [Passport](https://www.passportjs.org)
- **Linting**: ESLint + Prettier
- **Testing**: Vitest (front-end) + Jest (back-end)

## Monorepo Structure

It’s a majestic modular monorepo!

```txt
.
├── apps
│   ├── api       # NestJS back-end
│   └── web       # React + Vite front-end
├── package.json  # root workspace + scripts
└── README.md
```

## Bookmarklet

Linklater supports a simple “send this page to Linklater” bookmarklet by pre-filling the url + title via query params.

Example bookmarklet:

```js
javascript:(function(){
  const base = 'https://linklater.example.com';
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent(document.title);
  window.open(`${base}/?url=${url}&title=${title}`, '_blank','noopener,noreferrer');
})();
```

For local development:

```js
javascript:(function(){
  const base = 'http://localhost:5173';
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent(document.title);
  window.open(`${base}/?url=${url}&title=${title}`, '_blank','noopener,noreferrer');
})();
```

## Running The Project Locally

### Prerequisites

* Node.js (22.x recommended)
* PostgreSQL running locally with a “linklater” database

### Install Dependencies

```bash
# from the repo root
npm install
```

### Configure Environment Variables

Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://YOUR_PG_USER:YOUR_PG_PASSWORD@localhost:5432/linklater?schema=public"
JWT_SECRET="dev-secret-change-me"
```

Create `apps/web/.env`:

```env
VITE_API_BASE_URL="http://localhost:3000"
```

### Run Database Migrations

```bash
cd apps/api
npx prisma migrate dev --name init
```

### Start It Up

```bash
# from the repo root
npm run dev
```

This uses `concurrently` to run:
* NestJS on http://localhost:3000
* Vite on http://localhost:5173

Open http://localhost:5173 in your web browser.

### Linting, Tests, and CI

Both the front and back-end use ESLint and Prettier:

```bash
# lint everything
npm run lint

# lint front-end only
npm run lint --workspace @linklater/web

# lint back-end only
npm run lint --workspace @linklater/api
```

Vitest is used to test the front-end:

```bash
cd apps/web
npm run test
```

Jest is used to test the back-end:

```bash
cd apps/api
npm run test
```

GitHub Actions lint and test on pushes and PRs to `main`.

## Design Notes & Tradeoffs

- Created a monorepo to keep local dev simple and straightforward
- Used email/pass authentication for speed and simplicity
- Vite makes it real easy to spin up a UI and wire up Tailwind for styles
- Kept the UX focused on clarity
  - One main “Links” view with all actions
  - Separate “Settings” view for user account changes
  - Light/dark theme persistence via localStorage
- Back-end tests mock Prisma to avoid DB dependencies
- Front-end tests cover core UI behaviors

## Future Ideas To Grow This Into Something Extra

- Add OAuth2 support to login with Google, GitHub, etc.
- Fetch and store link metadata via a background job
- Link tags and collections
- Improve the full-text search
- Create browser extensions for one-click saving
