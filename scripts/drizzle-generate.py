#!/usr/bin/env python3
"""
Runs `drizzle-kit generate` under a pty so its prompts can be answered.

drizzle-kit asks whether a column or table was renamed or created afresh, and it
refuses to guess: without a terminal it aborts, and the answer decides whether a
migration preserves data or drops it. This runs it with a pty attached and
answers from `--answer` values given on the command line, so the choice is
recorded in the command rather than typed once and forgotten.

Each --answer is matched against the options of one prompt, in order. Anything
that does not match exactly one option aborts before a migration is written, as
does a prompt with no answer left for it: a wrong guess here is a dropped column.

    scripts/drizzle-generate.py --name rename_key --answer "rename column"
"""

import argparse
import os
import pty
import re
import select
import sys
import time

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
CURSOR = "❯"  # the ❯ marking the highlighted option
DOWN, ENTER = b"\x1b[B", b"\r"


def visible(raw: bytes) -> str:
    """What the terminal would show, with the escape sequences taken out."""
    return ANSI.sub("", raw.decode("utf8", "replace")).replace("\r", "")


def find_prompt(screen: str):
    """The question and its options, or None when nothing is waiting on input."""
    lines = [line.rstrip() for line in screen.split("\n")]
    cursor = next(
        (i for i in range(len(lines) - 1, -1, -1) if CURSOR in lines[i]), None
    )
    if cursor is None:
        return None
    start = cursor
    while start > 0 and lines[start - 1].strip():
        start -= 1
    options = [line for line in lines[start:] if line.strip()]
    # The question sits above the block, and is the nearest non-empty line.
    above = next(
        (lines[i] for i in range(start - 1, -1, -1) if lines[i].strip()), ""
    )
    selected = next(i for i, line in enumerate(options) if CURSOR in line)
    return above, options, selected


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--answer", action="append", default=[])
    known, passthrough = parser.parse_known_args()
    answers = list(known.answer)

    cmd = ["npx", "drizzle-kit", "generate", *passthrough]
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["COLUMNS"] = "200"
        os.execvp(cmd[0], cmd)

    screen, pending, deadline = "", b"", time.time() + 180
    while time.time() < deadline:
        ready, _, _ = select.select([fd], [], [], 0.7)
        if ready:
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                break
            if not chunk:
                break
            pending += chunk
            screen = visible(pending)
            continue

        # Output has gone quiet: either a prompt is waiting or the run is done.
        prompt = find_prompt(screen)
        if prompt is None:
            continue
        question, options, selected = prompt

        if not answers:
            print(f"\nUnanswered prompt:\n  {question.strip()}")
            for line in options:
                print(f"  {line}")
            print("\nRe-run with --answer matching one option. Nothing written.")
            os.kill(pid, 9)
            return 1

        wanted = answers.pop(0)
        matches = [i for i, line in enumerate(options) if wanted in line]
        if len(matches) != 1:
            print(f"\n--answer {wanted!r} matched {len(matches)} options:")
            for line in options:
                print(f"  {line}")
            print("\nNothing written.")
            os.kill(pid, 9)
            return 1

        target = matches[0]
        print(f"{question.strip()}\n  -> {options[target].strip()}")
        os.write(fd, DOWN * ((target - selected) % len(options)) + ENTER)
        pending, screen = b"", ""

    _, status = os.waitpid(pid, 0)
    code = os.waitstatus_to_exitcode(status)
    print(visible(pending))
    if answers:
        print(f"warning: {len(answers)} --answer value(s) went unused")
    return code


if __name__ == "__main__":
    sys.exit(main())
