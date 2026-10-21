/**
 * Copies Quick fastener's catalog in from robot-code, pinned to a ref (a
 * release tag, or a commit): the manifest `fs gen` writes from
 * `featurescripts/fasteners/fastenerTables.py` there: FRCDesign's library
 * fasteners, which Quick fastener inserts.
 *
 *     npm run sync:quick-fastener -- <ref>
 *     npm run sync:quick-fastener -- <ref> --from ../robot-code   # a local clone
 *
 * Writes, under `src/backend/features/quick-fastener/`, so a catalog change is
 * a diff here: `studios.gen.ts` (each Part Studio's configuration, as Onshape
 * answers it, and the countersunk heads: what the client imports), `catalog.gen.ts` (the parts' data,
 * which the server plans with) and `hole-scan.gen.ts` (the FeatureScript the
 * server evaluates).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REPO = "robot-education/robot-code";
const MANIFEST = "featurescripts/fasteners/fasteners.gen.json";
const OUT = "src/backend/features/quick-fastener";

async function readManifest(ref, from) {
    if (from) {
        return execFileSync("git", ["-C", from, "show", `${ref}:${MANIFEST}`], {
            encoding: "utf8"
        });
    }
    const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${MANIFEST}`;
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
            "Usage: npm run sync:quick-fastener -- <ref> [--from <robot-code clone>]"
        );
        process.exit(2);
    }
    const { holeScan, studios, ...catalog } = JSON.parse(
        await readManifest(ref, from)
    );
    const source = `${REPO}@${resolveCommit(ref, from)}`;
    const header = `/* Synced from ${source} (${MANIFEST}) by \`npm run sync:quick-fastener\` -- DO NOT EDIT */\n`;

    writeFileSync(
        `${OUT}/catalog.gen.ts`,
        `${header}\nexport const CATALOG_SOURCE = ${JSON.stringify(source)};\n\nexport const CATALOG = ${JSON.stringify(catalog, null, 4)};\n`
    );
    // One line: prettier would spread the configurations over thousands
    writeFileSync(
        `${OUT}/studios.gen.ts`,
        `${header}\nexport const STUDIOS = ${JSON.stringify(studios)};\n\nexport const COUNTERSUNK_HEADS = ${JSON.stringify(countersunkHeads(catalog))};\n`
    );
    writeFileSync(
        `${OUT}/hole-scan.gen.ts`,
        `${header}\nexport const HOLE_SCAN = ${JSON.stringify(holeScan)};\n`
    );
    execFileSync(
        "npx",
        [
            "prettier",
            "--write",
            `${OUT}/catalog.gen.ts`,
            `${OUT}/hole-scan.gen.ts`
        ],
        {
            stdio: "ignore"
        }
    );
    console.log(`Synced Quick fastener's catalog from ${source}.`);
}

await main();
