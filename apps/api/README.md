# NestJS Back-End

## Environment Variables

| Variable       | Required | Description                            |
| -------------- | -------- | -------------------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string           |
| `JWT_SECRET`   | Yes      | Used to sign and verify JWTs           |
| `APP_URL`      | Yes      | Public URL of the web app              |
| `SMTP_HOST`    | Yes      | SMTP server hostname                   |
| `SMTP_PORT`    | Yes      | SMTP server port                       |
| `SMTP_SECURE`  | Yes      | Set to `true` to use TLS               |
| `SMTP_USER`    | Yes      | SMTP authentication username           |
| `SMTP_PASS`    | Yes      | SMTP authentication password           |
| `SMTP_FROM`    | Yes      | `From` address for all outbound emails |

## Module Overview

| Module     | Path           | Responsibility                              |
| ---------- | -------------- | ------------------------------------------- |
| `Auth`     | `src/auth`     | Signup, login, JWTs, emails, password reset |
| `Email`    | `src/email`    | Send transactional emails                   |
| `Links`    | `src/links`    | Link CRUD, search, mark as read             |
| `Metadata` | `src/metadata` | Fetch Open Graph metadata tags              |
| `Prisma`   | `src/prisma`   | Prisma client                               |
| `Queue`    | `src/queue`    | Enqueue and process background jobs         |
| `Users`    | `src/users`    | Profile management, account deletion        |

## Authentication Strategy

Linklater uses **JWT authentication** via Passport.

1. `POST /auth/register` hashes the password with bcrypt and creates the user
2. `POST /auth/login` validates credentials and issues a signed JWT
3. All protected endpoints require an `Authorization: Bearer <token>` header
4. Tokens are validated by `JwtStrategy`
5. JWTs expire after **90 days**

Email verification is required for full access. Unverified users can still log in and use the app.

## Background Jobs

Two pg-boss job types run in the background:

- `fetch-metadata` is enqueued immediately after a link is created
- `read-link-cleanup` runs nightly and deletes read links older than seven days
