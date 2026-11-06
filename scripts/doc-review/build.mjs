/**
 * Builds one HTML page holding every Markdown file in the repository, the ones
 * a branch changed first with their diffs, for publishing as an Artifact. See
 * .claude/skills/review-docs/SKILL.md.
 *
 *     node scripts/doc-review/build.mjs --out <file.html> [--base <ref>] [--title <name>]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_BRANCH = "origin/cert";

/** In the picker's order; a file goes in the first group whose test it passes. */
const GROUPS = [
    {
        name: "Architecture",
        test: (path) => path.startsWith("docs/architecture/")
    },
    {
        name: "Strings",
        test: (path) => path.startsWith("docs/strings/")
    },
    {
        name: "Agent instructions",
        test: (path) =>
            path === "AGENTS.md" ||
            path === "CLAUDE.md" ||
            path.startsWith(".claude/")
    },
    { name: "Guides", test: () => true }
];

const git = (...args) =>
    execFileSync("git", args, {
        encoding: "utf8",
        maxBuffer: 64 << 20,
        stdio: ["ignore", "pipe", "pipe"]
    });

const lines = (text) => text.split("\n").filter(Boolean);

function parseArgs(argv) {
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--out") options.out = argv[++i];
        else if (arg === "--base") options.base = argv[++i];
        else if (arg === "--title") options.title = argv[++i];
        else throw new Error(`Unknown argument: ${arg}`);
    }
    if (!options.out) {
        throw new Error("Pass --out <file.html>");
    }
    return options;
}

function resolveBase(base) {
    if (base) return { ref: git("rev-parse", base).trim(), label: base };
    const ref = git("merge-base", "HEAD", DEFAULT_BASE_BRANCH).trim();
    return { ref, label: `${DEFAULT_BASE_BRANCH} (${ref.slice(0, 8)})` };
}

function markdownFiles() {
    const tracked = lines(git("ls-files", "--", "*.md"));
    const untracked = lines(
        git("ls-files", "--others", "--exclude-standard", "--", "*.md")
    );
    return { tracked: new Set(tracked), all: [...tracked, ...untracked] };
}

function existsAt(ref, path) {
    try {
        git("cat-file", "-e", `${ref}:${path}`);
        return true;
    } catch {
        return false;
    }
}

/** Against the working tree, so uncommitted edits are reviewed too. */
function diffFor(base, path, isTracked) {
    if (isTracked) return git("diff", base, "--", path);
    try {
        return git("diff", "--no-index", "--", "/dev/null", path);
    } catch (error) {
        // `--no-index` exits 1 when the files differ, which they do.
        return error.stdout ?? "";
    }
}

/**
 * A file's one title, without a strings file's suffix; a folder's index is
 * "Index", and a file of several top-level sections goes by its name.
 */
function labelFor(path, md) {
    if (basename(path) === "README.md" && path.startsWith("docs/")) {
        return "Index";
    }
    const prose = md.replace(/^```[\s\S]*?^```/gm, "");
    const titles = [...prose.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1]);
    if (titles.length !== 1) return basename(path);
    return titles[0].replace(/:\s*strings$/i, "");
}

function describe(path, base, isTracked) {
    const md = readFileSync(path, "utf8");
    const group = GROUPS.find((each) => each.test(path));
    return {
        id: path
            .replace(/\.md$/, "")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase(),
        path,
        group: group.name,
        label: labelFor(path, md),
        md,
        diff: diffFor(base, path, isTracked),
        isNew: !existsAt(base, path)
    };
}

/** Each group's index first, then by name. */
function compare(a, b) {
    const groupOrder = (doc) =>
        GROUPS.findIndex((group) => group.name === doc.group);
    return (
        groupOrder(a) - groupOrder(b) ||
        Number(a.label !== "Index") - Number(b.label !== "Index") ||
        a.label.localeCompare(b.label)
    );
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const base = resolveBase(options.base);
    const files = markdownFiles();
    const docs = files.all
        .map((path) => describe(path, base.ref, files.tracked.has(path)))
        .sort(compare);
    const dirty = git("status", "--porcelain", "--", "*.md").trim();
    const data = {
        title: options.title ?? "Doc review",
        branch: git("rev-parse", "--abbrev-ref", "HEAD").trim(),
        baseLabel: base.label,
        head:
            git("rev-parse", "--short", "HEAD").trim() +
            (dirty ? " + edits" : ""),
        groups: GROUPS.map((group) => group.name).filter((name) =>
            docs.some((doc) => doc.group === name)
        ),
        docs
    };

    const template = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "page.html"),
        "utf8"
    );
    // Inside a <script>, so nothing in the docs may close it.
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    const html = template
        .replace("__TITLE__", escapeHtml(data.title))
        .replace("/*__DATA__*/", () => json);
    writeFileSync(options.out, html);
    const changed = docs.filter((doc) => doc.diff).map((doc) => doc.path);
    console.log(
        `Wrote ${options.out}: ${docs.length} documents, changed: ${changed.join(", ") || "none"}`
    );
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

main();
