/**
 * Builds one HTML review page from docs/architecture and docs/strings: a tab
 * per document, each with its diff against a base, for publishing as an
 * Artifact. See .claude/skills/review-docs/SKILL.md.
 *
 *     node scripts/doc-review/build.mjs --out <file.html> [--base <ref>] [--title <name>] [paths...]
 *
 * With no paths it takes every document changed since the base, with its pair
 * (an area's architecture doc and its strings file).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DOC_DIRS = ["docs/architecture", "docs/strings"];
const DEFAULT_BASE_BRANCH = "origin/cert";

const git = (...args) =>
    execFileSync("git", args, {
        encoding: "utf8",
        maxBuffer: 64 << 20,
        stdio: ["ignore", "pipe", "pipe"]
    });

function parseArgs(argv) {
    const options = { paths: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--out") options.out = argv[++i];
        else if (arg === "--base") options.base = argv[++i];
        else if (arg === "--title") options.title = argv[++i];
        else options.paths.push(arg);
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

function isTracked(path) {
    try {
        git("ls-files", "--error-unmatch", path);
        return true;
    } catch {
        return false;
    }
}

/** Against the working tree, so uncommitted edits are reviewed too. */
function diffFor(base, path) {
    if (!isTracked(path)) {
        try {
            return git("diff", "--no-index", "--", "/dev/null", path);
        } catch (error) {
            // `--no-index` exits 1 when the files differ, which they do.
            return error.stdout ?? "";
        }
    }
    return git("diff", base, "--", path);
}

function existsAt(ref, path) {
    try {
        git("cat-file", "-e", `${ref}:${path}`);
        return true;
    } catch {
        return false;
    }
}

function changedDocs(base) {
    const tracked = git("diff", "--name-only", base, "--", ...DOC_DIRS)
        .split("\n")
        .filter(Boolean);
    const untracked = git(
        "ls-files",
        "--others",
        "--exclude-standard",
        "--",
        ...DOC_DIRS
    )
        .split("\n")
        .filter(Boolean);
    return [...tracked, ...untracked].filter(
        (path) => path.endsWith(".md") && existsSync(path)
    );
}

/** An area's architecture doc and its strings file are reviewed together. */
function withPairs(paths) {
    const all = new Set(paths);
    for (const path of paths) {
        const name = basename(path);
        if (name === "README.md") continue;
        for (const dir of DOC_DIRS) {
            const pair = join(dir, name);
            if (existsSync(pair)) all.add(pair);
        }
    }
    return [...all].sort(
        (a, b) =>
            isIndex(a) - isIndex(b) ||
            basename(a).localeCompare(basename(b)) ||
            isStrings(a) - isStrings(b)
    );
}

const isIndex = (path) => Number(basename(path) === "README.md");
const isStrings = (path) => Number(path.startsWith("docs/strings"));

function describe(path, base) {
    const md = readFileSync(path, "utf8");
    const heading = md.match(/^#\s+(.+)$/m)?.[1] ?? basename(path, ".md");
    const strings = isStrings(path) === 1;
    const label = heading.replace(/:\s*strings$/i, "");
    return {
        id:
            (strings ? "strings-" : "doc-") +
            basename(path, ".md").toLowerCase(),
        path,
        kind: isIndex(path) ? "Index" : strings ? "Strings" : "Doc",
        label,
        md,
        diff: diffFor(base, path),
        isNew: !existsAt(base, path)
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const base = resolveBase(options.base);
    const paths = withPairs(
        options.paths.length > 0 ? options.paths : changedDocs(base.ref)
    );
    if (paths.length === 0) {
        throw new Error(`No documents changed since ${base.label}`);
    }
    const branch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
    const dirty = git("status", "--porcelain", "--", ...DOC_DIRS).trim();
    const head =
        git("rev-parse", "--short", "HEAD").trim() + (dirty ? " + edits" : "");
    const data = {
        title: options.title ?? "Doc review",
        branch,
        baseLabel: base.label,
        head,
        docs: paths.map((path) => describe(path, base.ref))
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
    console.log(
        `Wrote ${options.out}: ${data.docs.map((doc) => doc.path).join(", ")}`
    );
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

main();
