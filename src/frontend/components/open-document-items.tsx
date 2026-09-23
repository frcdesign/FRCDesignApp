import { Menu } from "@mantine/core";
import { ArrowSquareOutIcon, LinkIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import {
    DocumentPath,
    ElementPath,
    InstancePath
} from "@backend/lib/onshape/path";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { IconSize, StatusColor } from "../lib/style-constants";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../lib/url";

interface OpenDocumentItemsProps {
    /** Any Onshape path; a shell group's stops at the document. */
    path: DocumentPath | InstancePath | ElementPath;
    /** The configuration to open an element in; its defaults when absent. */
    selection?: PartialSelection;
}

/** The menu items for reaching an element's Onshape document. */
export function OpenDocumentItems(props: OpenDocumentItemsProps): ReactNode {
    const url = makeUrl(props.path, props.selection);
    return (
        <>
            <Menu.Item
                color={StatusColor.INFO}
                leftSection={<ArrowSquareOutIcon size={IconSize.SMALL} />}
                onClick={() => openUrlInNewTab(url)}
            >
                Open document
            </Menu.Item>
            <Menu.Item
                color={StatusColor.INFO}
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
