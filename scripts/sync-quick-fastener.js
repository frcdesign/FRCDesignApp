/**
 * Copies Quick fastener's catalog in from robot-code, pinned to a ref (a
 * release tag, or a commit): the manifest `fs gen` writes from
 * `featurescripts/quickFastener/quickFastenerTables.py` there.
 *
 *     npm run sync:quick-fastener -- <ref>
 *     npm run sync:quick-fastener -- <ref> --from ../robot-code   # a local clone
 *
 * Writes `catalog.gen.ts` (what the client may import too) and
 * `hole-scan.gen.ts` (the FeatureScript the server evaluates), both under
 * `src/backend/features/quick-fastener/`, so a catalog change is a diff here.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REPO = "robot-education/robot-code";
const MANIFEST = "featurescripts/quickFastener/quickFastener.gen.json";
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

async function main() {
    const [ref, flag, from] = process.argv.slice(2);
    if (!ref || (flag && flag !== "--from") || (flag && !from)) {
        console.error(
            "Usage: npm run sync:quick-fastener -- <ref> [--from <robot-code clone>]"
        );
        process.exit(2);
    }
    const { holeScan, ...catalog } = JSON.parse(await readManifest(ref, from));
    const source = `${REPO}@${resolveCommit(ref, from)}`;
    const header = `/* Synced from ${source} (${MANIFEST}) by \`npm run sync:quick-fastener\` -- DO NOT EDIT */\n`;

    writeFileSync(
        `${OUT}/catalog.gen.ts`,
        `${header}\nexport const CATALOG_SOURCE = ${JSON.stringify(source)};\n\nexport const CATALOG = ${JSON.stringify(catalog, null, 4)};\n`
    );
    writeFileSync(
        `${OUT}/hole-scan.gen.ts`,
        `${header}\nexport const HOLE_SCAN = ${JSON.stringify(holeScan)};\n`
    );
    execFileSync("npx", ["prettier", "--write", `${OUT}/*.gen.ts`], {
        stdio: "ignore"
    });
    console.log(`Synced Quick fastener's catalog from ${source}.`);
}

await main();
