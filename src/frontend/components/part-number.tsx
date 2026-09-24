import { Text } from "@mantine/core";
import { ReactNode } from "react";
import { IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { ExternalLink } from "./external-link";

interface PartNumberProps {
    /** Already rendered, so a caller can underline what a query matched. */
    children: ReactNode;
    /** The vendor's page for it. */
    url?: string;
}

/** Keeps its width beside anything that can shrink, but still ellipsizes past its row's. */
export function PartNumber(props: PartNumberProps): ReactNode {
    const { children, url } = props;
    const text = (
        <Text component="span" inherit truncate miw={0}>
            {children}
        </Text>
    );
    if (!url) {
        return (
            <Text inherit truncate maw="100%" className={styles.noShrink}>
                {children}
            </Text>
        );
    }
    return (
        <ExternalLink
            href={url}
            inherit
            maw="100%"
            className={styles.noShrink}
            iconSize={IconSize.TINY}
        >
            {text}
        </ExternalLink>
    );
}
