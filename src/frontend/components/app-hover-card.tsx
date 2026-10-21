import { Box, HoverCard, type HoverCardProps } from "@mantine/core";
import type { MouseEvent, ReactNode } from "react";
import {
    holdOpenAfterTap,
    swallowDismissingClick,
    watchPresses
} from "../lib/hover-card-touch";

interface AppHoverCardProps extends Pick<
    HoverCardProps,
    "position" | "arrowSize" | "openDelay" | "closeDelay" | "interactive"
> {
    /** What is hovered or tapped. Wrapped, so it need not take a ref. */
    target: ReactNode;
    children: ReactNode;
    /** @default "md" */
    padding?: string;
}

// The card sits inside clickable rows, and React bubbles clicks out of portals.
const stopPropagation = (event: MouseEvent) => event.stopPropagation();

/**
 * Opens on hover, or on a tap. A tap outside closes it without reaching the
 * row underneath. Set `interactive` when the card holds controls.
 */
export function AppHoverCard(props: AppHoverCardProps): ReactNode {
    const { target, children, padding = "md", ...hoverCardProps } = props;

    return (
        <HoverCard
            {...hoverCardProps}
            onOpen={watchPresses}
            onDismiss={swallowDismissingClick}
        >
            <HoverCard.Target>
                <Box
                    ref={holdOpenAfterTap}
                    component="span"
                    display="inline-flex"
                    onClick={stopPropagation}
                >
                    {target}
                </Box>
            </HoverCard.Target>
            <HoverCard.Dropdown
                p={padding}
                maw="calc(100vw - 16px)"
                onClick={stopPropagation}
            >
                {children}
            </HoverCard.Dropdown>
        </HoverCard>
    );
}
