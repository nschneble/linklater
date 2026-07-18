# NestJS back-end

The Linklater REST API handles auth, link storage, background jobs,
and personal access tokens.

## File hierarchy

```mermaid
graph TD
    main["main.ts"]
    app["app.module.ts"]

    main --> app

    subgraph Auth["Auth"]
        auth["src/auth/"]
        auth_dto["src/auth/dto/"]
        auth --> auth_dto
    end

    subgraph Email["Email"]
        email["src/email/"]
        email_tmpl["src/email/templates/"]
        email --> email_tmpl
    end

    subgraph Links["Links"]
        links["src/links/"]
        links_dto["src/links/dto/"]
        links --> links_dto
    end

    subgraph Metadata["Metadata"]
        metadata["src/metadata/"]
    end

    subgraph Queue["Queue"]
        queue["src/queue/"]
    end

    subgraph Suggestions["Suggestions"]
        suggestions["src/suggestions/"]
        suggestions_dto["src/suggestions/dto/"]
        suggestions --> suggestions_dto
    end

    subgraph Tokens["Tokens"]
        tokens["src/tokens/"]
        tokens_dto["src/tokens/dto/"]
        tokens --> tokens_dto
    end

    subgraph Users["Users"]
        users["src/users/"]
        users_dto["src/users/dto/"]
        users --> users_dto
    end

    subgraph PrismaClient["Prisma Client"]
        prisma_src["src/prisma/"]
        prisma_gen["src/prisma/generated/"]
        prisma_src --> prisma_gen
    end

    subgraph PrismaSchema["Prisma Schema"]
        prisma_schema["prisma/schema.prisma"]
        prisma_migrations["prisma/migrations/"]
    end

    subgraph Common["Common"]
        common["src/common/ (shared utilities)"]
    end

    app --> auth
    app --> links
    app --> metadata
    app --> queue
    app --> suggestions
    app --> tokens
    app --> users
    app --> prisma_src

    auth --> email
    auth --> tokens
    auth --> users
    email --> queue
    links --> auth
    links --> queue
    metadata --> queue
    suggestions --> auth
    suggestions --> queue
    users --> auth

    prisma_schema -.->|generates| prisma_gen

    classDef authStyle fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    classDef emailStyle fill:#fef9c3,stroke:#ca8a04,color:#422006
    classDef linksStyle fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef metaStyle fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef queueStyle fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef suggestStyle fill:#fce7f3,stroke:#db2777,color:#500724
    classDef tokensStyle fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e
    classDef usersStyle fill:#f0fdf4,stroke:#15803d,color:#14532d
    classDef prismaStyle fill:#f1f5f9,stroke:#64748b,color:#1e293b
    classDef commonStyle fill:#fafafa,stroke:#a1a1aa,color:#18181b
    classDef coreStyle fill:#fff,stroke:#000,color:#000

    class auth,auth_dto authStyle
    class email,email_tmpl emailStyle
    class links,links_dto linksStyle
    class metadata metaStyle
    class queue queueStyle
    class suggestions,suggestions_dto suggestStyle
    class tokens,tokens_dto tokensStyle
    class users,users_dto usersStyle
    class prisma_src,prisma_gen,prisma_schema,prisma_migrations prismaStyle
    class common commonStyle
    class main,app coreStyle
```

## Where the wild components are

| I want to…                            | I should open…                               |
| ------------------------------------- | -------------------------------------------- |
| Add a background job                  | `src/queue/`                                 |
| Add a transactional email             | `src/email/templates/`                       |
| Add or change an auth flow            | `src/auth/`                                  |
| Adjust user profile                   | `src/users/`                                 |
| Change link CRUD or search            | `src/links/`                                 |
| Edit PAT lifecycle                    | `src/tokens/`                                |
| Edit shared utils                     | `src/common/`                                |
| Edit suggested links (RSS feeds)      | `src/suggestions/`                           |
| Touch the Prisma schema or migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Tweak Open Graph metadata fetching    | `src/metadata/`                              |
| Wire up a new OAuth provider          | `src/auth/*.strategy.ts`                     |

## A few explanations

All environment variables, defaults, and local development notes are in `.env.example`

The OpenAPI spec is served at `/openapi.json`

An unauthenticated `/health` endpoint returns `200` when the database answers a `SELECT 1` and `503` when it does not, so orchestrators and deploy checks can gate on it. The response body also reports the background-job queue state (`queue: 'up' | 'down'`) from an in-memory read of pg-boss — informational only, it does not change the status code

Coding patterns, NestJS rules, and migration requirements are documented in `.claude/CLAUDE.md` at the repo root
