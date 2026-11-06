---
name: review-docs
description: Publish every Markdown file in the repository (architecture docs, strings files, guides, agent instructions) as one Artifact page, the files this branch changed first with their diffs, and apply the comments the user leaves on it. Use at the end of any turn that changed a Markdown file, whenever the user asks to see, read or send a doc or an area's strings ("send me the auth doc", "show the build issues strings"), and when the user says to apply, address or go through their comments on the page, or a comment on it is sent to Claude.
---

# Review docs

The user reads on their phone, so every Markdown file lives on one page and
they never ask for a file. A sheet lists the files by folder (Architecture,
Strings, Agent instructions, Guides), each marked Changed or New when this
branch touched it, with a filter for just those. An open file is split into its
top-level sections, picked from tabs, one on screen at a time; a tab with
changes carries a dot. A changed file also has a **Diff** view. The user
comments with claude.ai's own comment mode; the page draws no comment controls.

## Build and publish

1. Build the page into your scratchpad directory:

    ```bash
    node scripts/doc-review/build.mjs --out <scratchpad>/doc-review.html --title "<name> review"
    ```

    - It takes every tracked or untracked, non-ignored `.md` file, and diffs each
      against where the branch left `origin/cert`, uncommitted edits included.
    - `--base <ref>` diffs against another ref: the PR's target if it isn't
      cert, or the commit before this turn when the user wants only this turn's
      changes.
    - `--title` names the branch's work in two to four words, such as
      "Cert cleanup review". Keep it for the life of the branch: it is how the
      page is found again.

2. Publish it with the `Artifact` tool. It declares no capabilities.
    - On the first publish, `icon: "document"` and a one-sentence
      `description`.
    - Within one session, publish the same file path again to update the same
      page. In a new session, find the page with `action: "list"` by its title,
      `read` it, then publish with its `url`, so the link stays the same.
3. Reply with the link in one line. To point at one file, add its id as the
   hash: the path without `.md`, every run of other characters as `-`,
   lowercased (`docs/architecture/auth.md` → `#docs-architecture-auth`). To
   point at a section, add `--` and the section's title the same way
   (`#docs-architecture-auth--storage`). Don't send the Markdown files
   themselves.

Publishing uploads the built file; nothing of it passes through the
conversation, so a page of every document costs no more than one of a few.
The page's look and behavior live in `scripts/doc-review/page.html`; change it
there, never in the built file.

## Apply comments

Comments reach you two ways:

- **Send to Claude** on a comment wakes this session with that thread. It is
  activated, so you can reply in it and resolve it.
- **A plain comment** wakes nothing. When the user asks you to apply their
  comments, read them all with `ArtifactComments` (`action: "read"`, the
  page's `url`). Each names the element it is anchored to and the nearest
  heading.

For each open thread:

1. Read what it is anchored to (a table cell, a paragraph, a code block) and
   treat its text as the user's request about that spot. When the anchor is too
   broad to tell what it means, such as a whole code block, ask rather than
   guess.
2. Make the change where it belongs: the code and the message catalog for a
   string, the document for its wording, both when a string changes.
3. On an activated thread, reply with what changed in a line, then resolve it.
   A question or an open choice gets an answer in the thread and stays open.
4. A plain thread can't be replied to or resolved from here. Answer its
   questions in your reply to the user, and list the threads you applied, so
   they can resolve them.

Then commit, rebuild and republish, so the user reviews the result in the same
place.
