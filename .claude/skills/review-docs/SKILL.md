---
name: review-docs
description: Publish the architecture docs and strings files changed on this branch as one tabbed review page (an Artifact) with diffs and a comment button on every row, and apply the comments the user leaves there. Use at the end of any turn that changed a file in docs/architecture/ or docs/strings/, when the user asks to review the docs or strings, and when the user says to apply, address or go through their comments on the review page, or a comment on it is sent to Claude.
---

# Review docs

The user reviews on their phone. One page holds every document the branch
changed, so they never switch between files and notes: a tab per document,
each with a **Document** view (changed rows and paragraphs highlighted) and a
**Changes** view (the diff), and a **Comment** button on every table row,
heading and document that opens claude.ai's own comment box.

## Build and publish

1. Build the page into your scratchpad directory:

    ```bash
    node scripts/doc-review/build.mjs --out <scratchpad>/doc-review.html --title "<name> review"
    ```

    - With no paths it takes every `.md` under `docs/architecture/` and
      `docs/strings/` changed since the branch left `origin/cert`, uncommitted
      edits included, each with its pair (an area's architecture doc and its
      strings file). Name files after the flags to send those instead.
    - `--base <ref>` diffs against another ref: the PR's target if it isn't
      cert, or the commit before this turn when the user wants only this turn's
      changes.
    - `--title` names the branch's work in two to four words, such as
      "Cert cleanup review". Keep it the same for the life of the branch: it is
      how the page is found again.

2. Publish it with the `Artifact` tool:
    - `capabilities: {"comments": {"composer_only": true}}`, which lets the
      buttons open the comment box and asks the user for no consent.
    - On the first publish, `icon: "document"` and a one-sentence
      `description`.
    - Within one session, publish the same file path again to update the same
      page. In a new session, find the page with `action: "list"` by its title,
      `read` it, then publish with its `url`, so the link stays the same.
3. Reply with the link in one line and say which documents changed. Don't also
   send the Markdown files.

The page's look and behavior live in `scripts/doc-review/page.html`; change it
there, never in the built file.

## Apply comments

Comments reach you two ways:

- **Send to Claude** on a comment wakes this session with that thread. It is
  activated, so you can reply in it and resolve it.
- **A plain comment** wakes nothing. When the user asks you to apply their
  comments, read them all with `ArtifactComments` (`action: "read"`, the
  page's `url`).

For each open thread:

1. Read what it is anchored to (a row's text, a heading, a whole document)
   and treat its text as the user's request about that spot.
2. Make the change where it belongs: the code and the message catalog for a
   string, the document for its wording, both when a string changes.
3. On an activated thread, reply with what changed in a line, then resolve it.
   A question or an open choice gets an answer in the thread and stays open.
4. A plain thread can't be replied to or resolved from here. List the ones you
   applied in your reply to the user, so they can resolve them, or send them
   to Claude next time.

Then commit, rebuild and republish the page, so the user reviews the result in
the same place.
