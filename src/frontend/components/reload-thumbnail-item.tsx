import { Menu } from "@mantine/core";
import { ImageIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize } from "../lib/style-constants";
import { useReloadThumbnailMutation } from "../features/library/queries";

interface ReloadThumbnailMenuItemProps {
    /** Whose thumbnail: a group's own, or one element's. */
    target: { groupId: string } | { insertableId: string };
}

/**
 * Asks Onshape for a thumbnail again. A load does not wait for one, so a
 * thumbnail Onshape had not written out yet stays missing until the whole
 * document is reloaded — which is a lot to do for one picture.
 */
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
