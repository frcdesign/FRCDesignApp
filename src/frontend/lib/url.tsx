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

/** A path, so it opens on the caller's own Onshape; see `useOnshapeOrigin`. */
export const APP_STORE_PATH =
    "/appstore/apps/Manufacturers%20Models/6004ec5e83c40b107c183347";

/** Where a caller manages the apps they have granted access. */
export const APPLICATIONS_PATH = "/user/applications";

/**
 * The company's domain for a company session, else cad's. Only https
 * onshape.com origins: anyone can write a launch url.
 */
export function toOnshapeOrigin(server: string | undefined): string {
    const url = server ? URL.parse(server) : null;
    const isOnshape =
        url?.protocol === "https:" &&
        (url.hostname === "onshape.com" ||
            url.hostname.endsWith(".onshape.com"));
    return isOnshape ? url.origin : DEFAULT_ONSHAPE_ORIGIN;
}

/** Opened in a new window so the insert menu stays. */
export const SETUP_URL = "/setup";

/** Onshape fills in whatever the configuration leaves out. */
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
        // Onshape unwraps exactly this one layer of escaping.
        url += "?configuration=" + encodeURIComponent(encoded);
    }
    return url;
}

/** Accepts a document link as well as one to a workspace or tab. */
export function parseOnshapeDocumentId(urlString: string): string | undefined {
    // Example pathname: /documents/{documentId}/w/{workspaceId}/e/{elementId}
    const url = URL.parse(urlString);
    if (!url) {
        return undefined;
    }
    const [, documents, documentId] = url.pathname.split("/");
    return documents === "documents" && documentId ? documentId : undefined;
}

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
