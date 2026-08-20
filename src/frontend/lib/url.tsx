import {
    DocumentPath,
    InstancePath,
    ElementPath,
    isInstancePath,
    isElementPath,
    InstanceType,
    ConfigurablePath,
    isConfigurablePath
} from "@backend/lib/onshape/path";
import { encodeConfigurationForQuery } from "@backend/features/configurations/utils";
import { notifications } from "@mantine/notifications";
import { IconLink } from "@tabler/icons-react";
import { IconSize } from "./style-constants";

export function makeUrl(path: ConfigurablePath): string;
export function makeUrl(path: ElementPath): string;
export function makeUrl(path: InstancePath): string;
export function makeUrl(path: DocumentPath): string {
    let url = `https://cad.onshape.com/documents/${path.documentId}`;
    if (isInstancePath(path)) {
        url += `/${path.instanceType}/${path.instanceId}`;
    }
    if (isElementPath(path)) {
        url += `/e/${path.elementId}`;
    }
    if (isConfigurablePath(path)) {
        url +=
            "?configuration=" + encodeConfigurationForQuery(path.configuration);
    }
    return url;
}

/**
 * Parses an Onshape document URL into an ElementPath.
 * Returns `undefined` if the URL could not be parsed successfully.
 */
export function parseUrl(urlString: string): ElementPath | undefined {
    try {
        // Example pathname: /documents/769b556baf61d32b18813fd0/w/e6d6c2b3a472b97a7e352949/e/8a0c13d3b2b68a99502dc436
        const url = new URL(urlString);
        const parts = url.pathname.split("/");
        // const configuration =
        //     url.searchParams.get("configuration") ?? undefined;
        return {
            documentId: parts[2],
            instanceId: parts[4],
            instanceType: parts[3] as InstanceType,
            elementId: parts[6]
        };
    } catch {
        return undefined;
    }
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
        icon: <IconLink size={IconSize.MEDIUM} />,
        color: "blue",
        autoClose: 3000
    });
}

/**
 * URL of the FRCDesign feedback Google Form.
 */
export const FEEDBACK_FORM_URL = "https://forms.gle/WVXUwnrrpLGKdiBx9";
