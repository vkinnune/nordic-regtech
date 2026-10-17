# Nordic RegTech

A regulation library and compliance workspace for browsing legal documents,
reviewing changes, and organizing tasks, policies, controls, and risks.

The frontend uses JavaScript, CSS, and Vite. The Python pipeline downloads public
regulatory sources, extracts sections and citations, and stores them in SQLite.
Workspace members and tasks are demonstration data.

## Development

Use the Node.js version in `.nvmrc`.

```sh
npm ci
npm run dev
```

## Checks

```sh
npm run lint
npm test
npm run format:check
npm run build
```

## Regulatory pipeline

See [pipeline/README.md](pipeline/README.md) for installation, supported sources,
commands, and known limitations.

```sh
cd pipeline
uv sync
uv run regtech --help
uv run pytest
```

Run `npm run pipeline:export` from the repository root to export stored regulations
for the frontend.

## Structure

- `src/`: frontend application and styles.
- `pipeline/`: ingestion, document storage, viewer, and Python tests.
- `functions/`: document-serving and access-control routes.
- `tests/`: frontend tests.
- `.github/workflows/`: validation and deployment workflows.
