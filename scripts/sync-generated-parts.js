/**
 * Copies what the app builds against in from robot-code, pinned to a ref (a
 * release tag, or a commit): what `fs gen` writes for the fasteners
 * (`featurescripts/fasteners/fastenerTables.py`). The fasteners' catalog and
 * studios themselves come from the manifest a library loads, not from here.
 *
 *     npm run sync:generated-parts -- <ref>
 *     npm run sync:generated-parts -- <ref> --from ../robot-code   # a local clone
 *
 * Writes, so a change is a diff here:
 *
 * - `src/backend/features/quick-fastener/hole-scan.gen.ts`: the FeatureScript
 *   the server evaluates to read holes, whose answer the app parses, so it
 *   ships with the app.
 * - `src/__test_utils__/fasteners-manifest.gen.ts`: the fasteners' manifest
 *   less its records, on one line, which tests build a `FastenerSet` from.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REPO = "robot-education/robot-code";
/** Each set of generated studios, by the name its studios are keyed under. */
const MANIFEST = "featurescripts/fasteners/fasteners.gen.json";
const QUICK_FASTENER = "src/backend/features/quick-fastener";
const FIXTURE = "src/__test_utils__/fasteners-manifest.gen.ts";

async function readManifest(path, ref, from) {
    if (from) {
        // A manifest is megabytes, past execFileSync's default 1 MB
        return execFileSync("git", ["-C", from, "show", `${ref}:${path}`], {
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024
        });
    }
    const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${path}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} answered ${response.status}`);
    }
    return response.text();
}

function resolveCommit(ref, from) {
    if (!from) {
        return ref;
    }
    return execFileSync("git", ["-C", from, "rev-parse", `${ref}^{commit}`], {
        encoding: "utf8"
    }).trim();
}

async function main() {
    const [ref, flag, from] = process.argv.slice(2);
    if (!ref || (flag && flag !== "--from") || (flag && !from)) {
        console.error(
            "Usage: npm run sync:generated-parts -- <ref> [--from <robot-code clone>]"
        );
        process.exit(2);
    }
    const source = `${REPO}@${resolveCommit(ref, from)}`;
    const header = `/* Synced from ${source} by \`npm run sync:generated-parts\` -- DO NOT EDIT */\n`;

    const manifest = JSON.parse(await readManifest(MANIFEST, ref, from));
    const { holeScan, ...rest } = manifest;
    const studios = Object.fromEntries(
        Object.entries(rest.studios).map(([key, studio]) => {
            const { records: _records, ...withoutRecords } = studio;
            return [key, withoutRecords];
        })
    );
    writeFileSync(
        FIXTURE,
        `${header}\nexport const FASTENERS_MANIFEST = ${JSON.stringify({ ...rest, source, studios })};\n`
    );
    writeFileSync(
        `${QUICK_FASTENER}/hole-scan.gen.ts`,
        `${header}\nexport const HOLE_SCAN = ${JSON.stringify(holeScan)};\n`
    );
    execFileSync(
        "npx",
        ["prettier", "--write", `${QUICK_FASTENER}/hole-scan.gen.ts`],
        { stdio: "ignore" }
    );
    console.log(`Synced the generated parts from ${source}.`);
}

await main();
