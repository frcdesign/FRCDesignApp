import { Text } from "@mantine/core";
import { ReactNode } from "react";
import styles from "../lib/styles.module.css";
import { AppLink } from "./app-link";

interface PartNumberProps {
    partNumber: string;
    /** How to draw it, e.g. with a query's matches underlined. @default partNumber */
    children?: ReactNode;
    /** The vendor's page for it. */
    url?: string;
}

/** Keeps its width beside anything that can shrink, but still ellipsizes past its row's. */
export function PartNumber(props: PartNumberProps): ReactNode {
    const { partNumber, children = partNumber, url } = props;
    const text = (
        <Text component="span" inherit truncate title={partNumber} miw={0}>
            {children}
        </Text>
    );
    if (!url) {
        return (
            <Text
                inherit
                truncate
                title={partNumber}
                maw="100%"
                className={styles.noShrink}
            >
                {children}
            </Text>
        );
    }
    return (
        <AppLink href={url} inherit maw="100%" className={styles.noShrink}>
            {text}
        </AppLink>
    );
}
