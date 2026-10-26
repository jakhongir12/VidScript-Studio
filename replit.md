# VidScript.ai

VidScript.ai imports public YouTube captions or transcribes uploaded audio/video into editable transcripts, translated captions, summaries, and downloadable SRT/VTT files.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/vidscript-ai/` — React + Vite web app
- `artifacts/api-server/` — Express API, transcription, YouTube caption import, translation, and summary routes
- `lib/api-spec/openapi.yaml` — API contract; regenerate clients with the codegen command above
- `lib/db/src/schema/projects.ts` — PostgreSQL transcript project schema

## Architecture decisions

- OpenAI Whisper processes uploaded media; FFmpeg extracts and splits audio into provider-sized chunks.
- YouTube links import existing public caption tracks; videos without accessible captions must be uploaded by the user.
- PostgreSQL stores transcripts and translations. Uploaded source media is temporary and deleted after processing.
- A signed, HTTP-only guest session cookie scopes each library without requiring account setup.

## Product

- Create a transcript library from media uploads or public YouTube captions.
- Edit transcripts and timed segments, generate summaries and translations, and export SRT or VTT subtitles.

## User preferences

_No additional preferences have been stated._

## Gotchas

- Upload transcription requires `ffmpeg`, `ffprobe`, and `OPENAI_API_KEY` at runtime.
- Re-run API codegen after changing `lib/api-spec/openapi.yaml`; push development schema changes with the DB command above.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
