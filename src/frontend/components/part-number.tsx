import { Anchor, Text } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, NO_SHRINK } from "../lib/style-constants";

interface PartNumberLinkProps {
    /** Already-rendered text, so a caller can underline what a query matched. */
    children: ReactNode;
    url: string;
}

/**
 * A part number pointing at the vendor's page for it. `inline-flex` so the icon
 * centres on the text rather than sitting on its baseline, and takes the link's
 * colour by being inside it.
 */
export function PartNumberLink(props: PartNumberLinkProps): ReactNode {
    const { children, url } = props;
    return (
        <Anchor
            href={url}
            target="_blank"
            inherit
            // The row inserts on click, which is not what the link is for.
            onClick={(event) => event.stopPropagation()}
            display="inline-flex"
            miw={0}
            maw="100%"
            style={{ alignItems: "center", gap: 2, ...NO_SHRINK }}
        >
            <Text component="span" inherit truncate miw={0}>
                {children}
            </Text>
            <ArrowSquareOutIcon size={IconSize.TINY} />
        </Anchor>
    );
}
