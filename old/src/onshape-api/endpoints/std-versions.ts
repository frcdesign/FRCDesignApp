import { OnshapeApi } from "../client/onshape-api";
import { getLatestVersion, getVersions } from "./versions";
import { STD_PATH } from "../objects/constants";

/** Returns the version number of the latest release of the Onshape standard library. */
export async function getLatestStdVersion(client: OnshapeApi): Promise<string> {
    const latest = await getLatestVersion(client, STD_PATH);
    const version = extractVersionNumber(latest.name);
    if (version === null) {
        throw new Error("Failed to parse Onshape std version: " + latest.name);
    }
    return version;
}

/**
 * Returns the version numbers of all releases of the Onshape standard library.
 *
 * Results are in chronological order, oldest first. The "Start" version is excluded.
 */
export async function getStdVersions(client: OnshapeApi): Promise<string[]> {
    const versions = await getVersions(client, STD_PATH);
    return versions
        .slice(1) // omit "Start"
        .map((v) => extractVersionNumber(v.name))
        .filter((v): v is string => v !== null);
}

function extractVersionNumber(versionName: string): string | null {
    const match = versionName.match(/^(\d+)\.0$/);
    return match ? match[1] : null;
}
