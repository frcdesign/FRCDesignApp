import {
    DocumentPath,
    InstancePath,
    ElementPath,
    isInstancePath,
    isElementPath
} from "@backend/lib/onshape/path";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { encodeQueryConfiguration } from "@backend/features/configurations/utils";
import { notifications } from "@mantine/notifications";
import { LinkIcon } from "@phosphor-icons/react";
import { IconSize } from "./style-constants";

/** Onshape for anyone outside a company, and for a caller who never launched. */
export const DEFAULT_ONSHAPE_ORIGIN = "https://cad.onshape.com";

/**
 * The app's listing in the Onshape App Store, where it is subscribed to. A
 * path, so it opens on the caller's own Onshape; see `useOnshapeOrigin`.
 */
export const APP_STORE_PATH =
    "/appstore/apps/Manufacturers%20Models/6004ec5e83c40b107c183347";

/** Where a caller manages the apps they have granted access. */
export const APPLICATIONS_PATH = "/user/applications";

/**
 * The origin of the Onshape a launch came from — a company's own domain, such
 * as frcdesign.onshape.com, for a company session — or cad's without one. Only
 * an https onshape.com origin: the launch is a url anyone can write, and links
 * built on this are opened as Onshape's.
 */
export function toOnshapeOrigin(server: string | undefined): string {
    const url = server ? URL.parse(server) : null;
    const isOnshape =
        url?.protocol === "https:" &&
        (url.hostname === "onshape.com" ||
            url.hostname.endsWith(".onshape.com"));
    return isOnshape ? url.origin : DEFAULT_ONSHAPE_ORIGIN;
}

/**
 * The setup instructions. Opened in a window of their own: a navigation would
 * take the insert menu they are offered from with it.
 */
export const SETUP_URL = "/setup";

/**
 * The Onshape url for a path. A configuration applies only to an element, and
 * only what it names changes: Onshape fills in the rest from the defaults.
 */
export function makeUrl(
    origin: string,
    path: DocumentPath | InstancePath | ElementPath,
    configuration?: PartialSelection
): string {
    let url = `${origin}/documents/${path.documentId}`;
    if (isInstancePath(path)) {
        url += `/${path.instanceType}/${path.instanceId}`;
    }
    if (isElementPath(path)) {
        url += `/e/${path.elementId}`;
    }
    const encoded = encodeQueryConfiguration(configuration);
    if (isElementPath(path) && encoded) {
        // Onshape's own parameter, so it keeps Onshape's name. The query form,
        // this escape being the one layer Onshape unwraps.
        url += "?configuration=" + encodeURIComponent(encoded);
    }
    return url;
}

/**
 * The document a pasted Onshape url names, or undefined when it names none.
 * Only the document id: a url pointing at a workspace or a tab carries more,
 * but a link to the document itself does not, and both are worth accepting.
 */
export function parseOnshapeDocumentId(urlString: string): string | undefined {
    // Example pathname: /documents/{documentId}/w/{workspaceId}/e/{elementId}
    const url = URL.parse(urlString);
    if (!url) {
        return undefined;
    }
    const [, documents, documentId] = url.pathname.split("/");
    return documents === "documents" && documentId ? documentId : undefined;
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
