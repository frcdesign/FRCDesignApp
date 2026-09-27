/**
 * Fails when a doc names a file that no longer exists: a path in backticks
 * under one of the repo's top-level directories, or a relative markdown link.
 * A moved or renamed file is the most common way the docs drift from the code.
 *
 *     npm run check:docs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DOC_DIRS = ["docs", "docs/architecture"];
const ROOT_FILES = ["AGENTS.md", "README.md"];
const CHECKED_ROOTS = ["src/", "docs/", "drizzle/", "scripts/"];

function docFiles() {
    const files = [...ROOT_FILES];
    for (const dir of DOC_DIRS) {
        for (const name of readdirSync(dir)) {
            if (name.endsWith(".md")) files.push(join(dir, name));
        }
    }
    return files;
}

/** Backticked paths under a checked root; globs and placeholders are skipped. */
function namedPaths(text) {
    const paths = [];
    for (const [, code] of text.matchAll(/`([^`\n]+)`/g)) {
        for (const token of code.split(/[\s,]+/)) {
            if (!CHECKED_ROOTS.some((root) => token.startsWith(root))) continue;
            if (/[*{}<>]/.test(token)) continue;
            paths.push(token.replace(/[.:;)]+$/, ""));
        }
    }
    return paths;
}

/** Relative link targets, without their anchors. */
function linkedPaths(text) {
    const paths = [];
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z]+:/i.test(target) || target.startsWith("#")) continue;
        paths.push(target.split("#")[0]);
    }
    return paths;
}

const missing = [];
for (const file of docFiles()) {
    const text = readFileSync(file, "utf8");
    for (const path of namedPaths(text)) {
        if (!existsSync(path)) missing.push(`${file}: \`${path}\``);
    }
    for (const path of linkedPaths(text)) {
        if (!existsSync(resolve(dirname(file), path))) {
            missing.push(`${file}: link ${path}`);
        }
    }
}

if (missing.length > 0) {
    console.error("Docs name paths that don't exist:\n");
    for (const line of missing) console.error(`  ${line}`);
    process.exit(1);
}
console.log("Every path the docs name exists.");
