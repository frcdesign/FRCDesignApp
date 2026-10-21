---
name: send-architecture-docs
description: Send one or more of the architecture docs in docs/architecture/ to the user as rendered Markdown in the chat. Use when the user asks to see, read, open, send or share an architecture doc ("send me the auth doc", "show the fasten architecture", "send all the architecture docs"), or when a doc would answer their question better than a summary.
---

# Send architecture docs

The docs live in `docs/architecture/`, one per feature area. `README.md` there is
the index: it maps each file to the area it covers. Read it to match what the user
asked for to a file, unless the name alone makes the match obvious (`auth` →
`auth.md`).

## Pick the files

- A named area → that file. Several → all of them, in one send.
- "All of them" → every `.md` in `docs/architecture/`, `README.md` first.
- Nothing matches → send `README.md` and say which areas exist.
- Send the file as it is in the working tree, including edits from this session
  that aren't committed yet; say so when it has some (`git status --short docs/`).

## Send them

Use `SendUserFile` with every chosen path in one call:

- `files`: paths relative to the repository root, e.g.
  `docs/architecture/fasten.md`
- `display`: `"render"`, so they open as formatted Markdown
- `status`: `"normal"`
- `caption`: one line naming what was sent, when more than one file goes

Without `SendUserFile` (the terminal, say), publish each file with the
`Artifact` tool instead. This skill asks for Markdown, so publish the `.md` file
itself rather than building an HTML page: `file_path` is the doc, `icon` is
`book`, and `description` is the first sentence of its **Purpose** section.
Publishing the same path again later in the conversation updates the same page.

## After sending

Send the doc as written: don't summarize, rewrite or excerpt it unless the user
asks. Links between docs (`./auth.md`) don't resolve once rendered here, so when
a sent doc points at another the user is likely to want, name that one and offer
to send it.
