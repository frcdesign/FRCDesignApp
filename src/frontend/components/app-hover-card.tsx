import { Box, HoverCard, Popover, type PopoverProps } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { MouseEvent, ReactNode } from "react";

interface AppHoverCardProps extends Pick<
    PopoverProps,
    "position" | "arrowSize"
> {
    /** What is hovered or tapped. Wrapped, so it need not take a ref. */
    target: ReactNode;
    children: ReactNode;
    /** @default "md" */
    padding?: string;
    /** @default 0 */
    openDelay?: number;
    /** @default 150 */
    closeDelay?: number;
}

// The card sits inside clickable rows, and React bubbles clicks out of portals.
const stopPropagation = (event: MouseEvent) => event.stopPropagation();

/** Opens on hover, or on a tap where there is no hover. */
export function AppHoverCard(props: AppHoverCardProps): ReactNode {
    const {
        target,
        children,
        padding = "md",
        openDelay,
        closeDelay,
        ...popoverProps
    } = props;
    const canHover = useMediaQuery("(hover: hover)", undefined, {
        getInitialValueInEffect: false
    });

    const shared = {
        ...popoverProps,
        // So a card beside a row on a phone is pushed on screen, not cut off.
        middlewares: { flip: true, shift: { crossAxis: true, padding: 8 } },
        withinPortal: true,
        shadow: "md",
        withArrow: true
    };
    const targetBox = (
        <Box component="span" display="inline-flex" onClick={stopPropagation}>
            {target}
        </Box>
    );
    const dropdownProps = {
        p: padding,
        maw: "calc(100vw - 16px)",
        onClick: stopPropagation
    };

    if (canHover) {
        return (
            <HoverCard
                {...shared}
                openDelay={openDelay}
                closeDelay={closeDelay}
            >
                <HoverCard.Target>{targetBox}</HoverCard.Target>
                <HoverCard.Dropdown {...dropdownProps}>
                    {children}
                </HoverCard.Dropdown>
            </HoverCard>
        );
    }
    return (
        <Popover
            {...shared}
            // Takes the dismissing tap, so the row underneath doesn't get it too.
            withOverlay
            overlayProps={{ backgroundOpacity: 0, onClick: stopPropagation }}
            clickOutsideEvents={["click"]}
        >
            <Popover.Target>{targetBox}</Popover.Target>
            <Popover.Dropdown {...dropdownProps}>{children}</Popover.Dropdown>
        </Popover>
    );
}
