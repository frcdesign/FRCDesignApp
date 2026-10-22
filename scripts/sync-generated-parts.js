/**
 * Copies the generated parts' manifests in from robot-code, pinned to a ref (a
 * release tag, or a commit): what `fs gen` writes for each set of FeatureScript-
 * generated Part Studios there, such as the fasteners'
 * (`featurescripts/fasteners/fastenerTables.py`).
 *
 *     npm run sync:generated-parts -- <ref>
 *     npm run sync:generated-parts -- <ref> --from ../robot-code   # a local clone
 *
 * Writes, so a change to a generated part is a diff here:
 *
 * - `src/backend/features/generated-parts/studios.gen.ts`: each studio's
 *   configuration, as Onshape answers it, and where it's released; the client
 *   imports it.
 * - `src/backend/features/generated-parts/records.gen.ts`: each studio's part
 *   per configuration, which a load indexes; the server's alone.
 * - Under `src/backend/features/quick-fastener/`, from the fasteners' manifest:
 *   `catalog.gen.ts` (the parts' dimensions, which it plans with),
 *   `heads.gen.ts` (the countersunk heads, for the client) and
 *   `hole-scan.gen.ts` (the FeatureScript the server evaluates).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REPO = "robot-education/robot-code";
/** Each set of generated studios, by the name its studios are keyed under. */
const SETS = { fasteners: "featurescripts/fasteners/fasteners.gen.json" };
const OUT = "src/backend/features/generated-parts";
const QUICK_FASTENER = "src/backend/features/quick-fastener";

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

/** A washer can't go under these, which sit in their countersinks. */
function countersunkHeads(catalog) {
    return catalog.heads
        .filter((head) =>
            Object.values(head.sizes).some((size) => size.countersunk)
        )
        .map((head) => head.id);
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

    const studios = [];
    const records = {};
    let fasteners;
    for (const [set, path] of Object.entries(SETS)) {
        const manifest = JSON.parse(await readManifest(path, ref, from));
        for (const [key, studio] of Object.entries(manifest.studios)) {
            const { records: studioRecords, ...rest } = studio;
            studios.push({ set, key, ...rest });
            records[`${set}/${key}`] = studioRecords;
        }
        if (set === "fasteners") {
            fasteners = manifest;
        }
    }

    // One line each: prettier would spread them over tens of thousands
    writeFileSync(
        `${OUT}/studios.gen.ts`,
        `${header}\nexport const GENERATED_SOURCE = ${JSON.stringify(source)};\n\nexport const GENERATED_STUDIOS = ${JSON.stringify(studios)};\n`
    );
    writeFileSync(
        `${OUT}/records.gen.ts`,
        `${header}\nexport const GENERATED_RECORDS = ${JSON.stringify(records)};\n`
    );

    const { holeScan, studios: _studios, ...catalog } = fasteners;
    writeFileSync(
        `${QUICK_FASTENER}/catalog.gen.ts`,
        `${header}\nexport const CATALOG = ${JSON.stringify(catalog, null, 4)};\n`
    );
    writeFileSync(
        `${QUICK_FASTENER}/heads.gen.ts`,
        `${header}\nexport const COUNTERSUNK_HEADS = ${JSON.stringify(countersunkHeads(catalog))};\n`
    );
    writeFileSync(
        `${QUICK_FASTENER}/hole-scan.gen.ts`,
        `${header}\nexport const HOLE_SCAN = ${JSON.stringify(holeScan)};\n`
    );
    execFileSync(
        "npx",
        [
            "prettier",
            "--write",
            `${QUICK_FASTENER}/catalog.gen.ts`,
            `${QUICK_FASTENER}/heads.gen.ts`,
            `${QUICK_FASTENER}/hole-scan.gen.ts`
        ],
        { stdio: "ignore" }
    );
    console.log(`Synced the generated parts from ${source}.`);
}

await main();
