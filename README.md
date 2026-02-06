# JadenTripp.github.io

Personal site built with Bun, TypeScript, Pug templates, and markdown/json content files.

## Stack

- Bun
- TypeScript
- Pug
- gray-matter + marked
- chokidar (dev watch + live reload)

## Project Structure

- `content/pages/` Static page content (`.md`) and homepage metadata (`home.json`)
- `content/posts/` Blog posts (`.md`)
- `content/art/` Art entries (`.md`)
- `src/templates/` Pug templates and partials
- `assets/` CSS, JS, images, and `/write` UI assets
- `scripts/` Build and dev server scripts
- `dist/` Generated static output

## Scripts

- `bun run dev` Start local dev server with rebuild + live reload (`http://localhost:4173`)
- `bun run build` Build static site into `dist/`
- `bun run typecheck` Run TypeScript checks

## Content Notes

- Blog and art content are generated from markdown frontmatter.
- Set `published: false` to hide an entry.
- Current repo state keeps `content/art/.gitkeep` and no published art/blog entries by default.

## Deployment

GitHub Actions workflow is in `.github/workflows/deploy.yml`.
