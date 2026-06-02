# NestJS Back-End

REST API for Linklater — handles auth, link storage, background jobs,
and personal access tokens.

## File Hierarchy

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
        common["src/common/"]
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
    links --> queue
    suggestions --> queue

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
    class main,app prismaStyle
```

## Where Things Live

| I want to...                              | Open                                          |
| ----------------------------------------- | --------------------------------------------- |
| Add or change an auth flow                | `src/auth/`                                   |
| Wire a new OAuth provider                 | `src/auth/*.strategy.ts`                      |
| Add a transactional email                 | `src/email/templates/`                        |
| Change link CRUD or search                | `src/links/`                                  |
| Tweak Open Graph metadata fetching        | `src/metadata/`                               |
| Add a background job                      | `src/queue/`                                  |
| Edit suggested links (RSS / Wikipedia)    | `src/suggestions/`                            |
| Edit PAT lifecycle (create / revoke)      | `src/tokens/`                                 |
| Touch the Prisma schema or migrations     | `prisma/schema.prisma`, `prisma/migrations/`  |
| Adjust user profile / deletion            | `src/users/`                                  |
| Edit shared crypto, date, or logger utils | `src/common/`                                 |

## Pointers

- **Environment variables** — all vars, defaults, and local dev notes are in
  [`.env.example`](./.env.example).
- **Endpoint contracts** — the machine-readable OpenAPI spec is served at
  `/openapi.json` and rendered in the app at `/settings/api`.
- **Conventions** — coding patterns, NestJS rules, and migration requirements
  are documented in [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) at the
  repo root.
- **Monorepo setup** — local dev commands and workspace structure are in the
  [root README](../../README.md).
