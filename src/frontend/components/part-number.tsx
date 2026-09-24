import { Anchor, Text } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";

interface PartNumberLinkProps {
    /** Already-rendered text, so a caller can underline what a query matched. */
    children: ReactNode;
    url: string;
    /** For a list row; a header lets a long part number ellipsize instead. */
    noShrink?: boolean;
}

export function PartNumberLink(props: PartNumberLinkProps): ReactNode {
    const { children, url, noShrink = false } = props;
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
            className={noShrink ? styles.noShrink : undefined}
            style={{ alignItems: "center", gap: 2 }}
        >
            <Text component="span" inherit truncate miw={0}>
                {children}
            </Text>
            <ArrowSquareOutIcon size={IconSize.TINY} />
        </Anchor>
    );
}
