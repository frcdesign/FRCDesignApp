import { Menu } from "@mantine/core";
import { ArrowSquareOutIcon, LinkIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import {
    ConfigurablePath,
    DocumentPath,
    InstancePath
} from "@backend/lib/onshape/path";
import { IconSize } from "../lib/style-constants";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../lib/url";

interface OpenDocumentItemsProps {
    /** Any Onshape path; a shell group's stops at the document. */
    path: DocumentPath | InstancePath | ConfigurablePath;
}

/** The menu items for reaching an element's Onshape document. */
export function OpenDocumentItems(props: OpenDocumentItemsProps): ReactNode {
    const url = makeUrl(props.path);
    return (
        <>
            <Menu.Item
                leftSection={<ArrowSquareOutIcon size={IconSize.SMALL} />}
                onClick={() => openUrlInNewTab(url)}
            >
                Open document
            </Menu.Item>
            <Menu.Item
                leftSection={<LinkIcon size={IconSize.SMALL} />}
                onClick={() => {
                    void copyUrlToClipboard(url);
                }}
            >
                Copy link
            </Menu.Item>
        </>
    );
}
