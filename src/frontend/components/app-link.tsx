import { Anchor, type AnchorProps } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { type MouseEvent, type ReactNode } from "react";
import styles from "./app-link.module.css";

interface AppLinkProps extends AnchorProps {
    href: string;
    children?: ReactNode;
    /** The out-arrow, sized to the text. @default true */
    withIcon?: boolean;
}

// Links sit inside clickable rows, whose click they aren't meant for.
const stopPropagation = (event: MouseEvent) => event.stopPropagation();

/** Every link the app draws: it opens in a new tab, since the app lives in Onshape's panel. */
export function AppLink(props: AppLinkProps): ReactNode {
    const { href, children, withIcon = true, className, ...others } = props;
    const layout = children === undefined ? styles.iconOnly : styles.link;
    return (
        <Anchor
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={stopPropagation}
            className={withIcon ? `${layout} ${className ?? ""}` : className}
            {...others}
        >
            {children}
            {withIcon && (
                <ArrowSquareOutIcon
                    size="1em"
                    className={children === undefined ? undefined : styles.icon}
                />
            )}
        </Anchor>
    );
}
