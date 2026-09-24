import { Menu } from "@mantine/core";
import { ImageIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize } from "../../../lib/style-constants";
import { useReloadThumbnailMutation } from "../queries";

interface ReloadThumbnailMenuItemProps {
    /** Whose thumbnail: a group's own, or one element's. */
    target: { groupId: string } | { insertableId: string };
}

/** A load doesn't wait for thumbnails, so this refetches one without reloading the document. */
export function ReloadThumbnailMenuItem(
    props: ReloadThumbnailMenuItemProps
): ReactNode {
    const mutation = useReloadThumbnailMutation(props.target);
    return (
        <Menu.Item
            leftSection={<ImageIcon size={IconSize.SMALL} />}
            onClick={() => mutation.mutate()}
        >
            Reload thumbnail
        </Menu.Item>
    );
}
