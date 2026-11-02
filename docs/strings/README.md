# User-facing strings

One file per feature area, beside its document in
[`docs/architecture/`](../architecture/README.md), listing the strings the area
shows a user that are worth a reviewer's read: titles, labels, descriptions,
placeholders, prompts sent to Onshape, toasts, tips, and errors written for the
user.

| File                                 | Area                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| [build-issues.md](./build-issues.md) | Build issues, the admin card, and the Admin settings |

## Shape of a file

- A short opening line: the area's document, and where its strings live in the
  code.
- One section per place a person meets them — a card section, a menu, a
  dialog — each a table with these columns:
    - **String**, word for word, in quotes. A string built from values shows
      them as `{name}`; variants of one string share a row, split by `/`.
    - **Kind**: what it is on screen — badge, tooltip, switch label, row
      description, section title, confirm title or body, loading, success or
      error toast.
    - **Where** it appears; blank for a toast.
    - **When** it shows: the state or action that brings it up, so a reviewer
      can judge it without opening the app.
    - **Review**: **⚑** and a few words for a string that particularly wants
      attention — one that may not need to exist at all, depending on
      preference; one that is long; one that repeats another; or one that is
      new or reworded and has likely not been reviewed before. Blank otherwise.
- A set of strings with a shape of its own, such as build issues' title,
  description, severity and trigger, gets a table in that shape instead.

Leave out trivial, uncontroversial strings: a "Save" or "Cancel" button, a
column heading that only names its column.

Update a file in the same commit as the strings it lists; `AGENTS.md` has the
rule.
