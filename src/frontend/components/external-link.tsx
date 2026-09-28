import { Anchor, type AnchorProps } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { type MouseEvent, type ReactNode } from "react";
import { IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";

interface ExternalLinkProps extends AnchorProps {
    href: string;
    children?: ReactNode;
    /** Adds the out-arrow after the text at this size. */
    iconSize?: IconSize;
}

// Links sit inside clickable rows, whose click they aren't meant for.
const stopPropagation = (event: MouseEvent) => event.stopPropagation();

/** Opens in a new tab. */
export function ExternalLink(props: ExternalLinkProps): ReactNode {
    const { href, children, iconSize, className, ...others } = props;
    return (
        <Anchor
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={stopPropagation}
            className={
                iconSize
                    ? `${styles.externalLink} ${className ?? ""}`
                    : className
            }
            {...others}
        >
            {children}
            {iconSize && <ArrowSquareOutIcon size={iconSize} />}
        </Anchor>
    );
}
