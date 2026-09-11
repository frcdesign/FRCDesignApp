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
