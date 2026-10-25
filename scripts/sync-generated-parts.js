/**
 * Copies the fasteners' manifest in from robot-code, pinned to a ref (a release
 * tag, or a commit), as a test fixture: what `fs gen` writes for them
 * (`featurescripts/fasteners/fastenerTables.py`). The app itself reads the
 * manifest a library loads, never this.
 *
 *     npm run sync:generated-parts -- <ref>
 *     npm run sync:generated-parts -- <ref> --from ../robot-code   # a local clone
 *
 * Writes `src/__test_utils__/fasteners-manifest.gen.ts`: the manifest less its
 * records, on one line, which tests build a `FastenerSet` from.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REPO = "robot-education/robot-code";
/** Each set of generated studios, by the name its studios are keyed under. */
const MANIFEST = "featurescripts/fasteners/fasteners.gen.json";
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
    const studios = Object.fromEntries(
        Object.entries(manifest.studios).map(([key, studio]) => {
            const { records: _records, ...withoutRecords } = studio;
            return [key, withoutRecords];
        })
    );
    writeFileSync(
        FIXTURE,
        `${header}\nexport const FASTENERS_MANIFEST = ${JSON.stringify({ ...manifest, source, studios })};\n`
    );
    console.log(`Synced the generated parts from ${source}.`);
}

await main();
