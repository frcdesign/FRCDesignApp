import {
    DocumentPath,
    InstancePath,
    ElementPath,
    isInstancePath,
    isElementPath,
    ConfigurablePath,
    isConfigurablePath
} from "@backend/lib/onshape/path";
import { encodeConfiguration } from "@backend/features/configurations/utils";
import { notifications } from "@mantine/notifications";
import { LinkIcon } from "@phosphor-icons/react";
import { IconSize } from "./style-constants";

/** The app's listing in the Onshape App Store, where it is subscribed to. */
export const APP_STORE_URL =
    "https://cad.onshape.com/appstore/apps/Manufacturers%20Models/6004ec5e83c40b107c183347";

/**
 * The setup instructions. Opened in a window of their own: a navigation would
 * take the insert menu they are offered from with it.
 */
export const SETUP_URL = "/setup";

export function makeUrl(path: ConfigurablePath): string;
export function makeUrl(path: ElementPath): string;
export function makeUrl(path: InstancePath): string;
export function makeUrl(path: DocumentPath): string;
export function makeUrl(path: DocumentPath): string {
    let url = `https://cad.onshape.com/documents/${path.documentId}`;
    if (isInstancePath(path)) {
        url += `/${path.instanceType}/${path.instanceId}`;
    }
    if (isElementPath(path)) {
        url += `/e/${path.elementId}`;
    }
    if (isConfigurablePath(path)) {
        // Onshape's own parameter, so it keeps Onshape's name. Escaped here:
        // the helper's raw output is what their api takes.
        url +=
            "?configuration=" +
            encodeURIComponent(encodeConfiguration(path.selection));
    }
    return url;
}

/**
 * Opens the given URL in a new tab.
 */
export function openUrlInNewTab(url: string) {
    window.open(url, "_blank");
}

export async function copyUrlToClipboard(url: string): Promise<void> {
    await navigator.clipboard.writeText(url);
    notifications.show({
        message: "Link copied to clipboard.",
        icon: <LinkIcon size={IconSize.MEDIUM} />,
        color: "blue",
        autoClose: 3000
    });
}
