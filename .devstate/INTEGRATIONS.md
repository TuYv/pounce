# DevState Integration Snippets

Use these snippets as copy-paste starting points for `CLAUDE.md`, `AGENTS.md`, or `.cursorrules`.

## Shared Rule

- At the start of a new session, read `.devstate/STATE.md`.
- If working on a specific thread, also read `.devstate/contexts/<slug>.md`.
- Before checkpointing, run `python3 devstate.py scan [path] [--context <slug>]`.
- Then run `python3 devstate.py prompt [path] [--context <slug>]` and use the output to overwrite the matching snapshot file.
- DevState files are snapshots. Overwrite them on checkpoint; never append logs.

## CLAUDE.md

```md
## DevState
- Start each session by reading `.devstate/STATE.md`.
- If this task belongs to a specific thread, also read `.devstate/contexts/<slug>.md`.
- After finishing a coherent task, run `python3 devstate.py scan --context <slug>` when relevant, then update the matching DevState snapshot by overwriting it.
- Treat `.devstate/STATE.md` and `.devstate/contexts/*.md` as compact snapshots, not append-only journals.
```

## AGENTS.md

```md
## DevState
- Read `.devstate/STATE.md` before substantial work.
- Read `.devstate/contexts/<slug>.md` when a task is part of an active thread.
- Use `python3 devstate.py scan` before checkpointing and overwrite the relevant DevState snapshot from the generated prompt.
- Keep DevState snapshots concise and current; stale information should disappear on the next checkpoint.
```

## .cursorrules

```md
- Read `.devstate/STATE.md` when a session starts.
- Read `.devstate/contexts/<slug>.md` for thread-specific context.
- After a meaningful change, run `python3 devstate.py scan` and use `python3 devstate.py prompt` to regenerate the appropriate DevState snapshot.
- DevState is overwrite-only compaction, not append-only history.
```
