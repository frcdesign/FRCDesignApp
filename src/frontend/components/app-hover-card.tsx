import { Box, Popover, type PopoverProps } from "@mantine/core";
import {
    createContext,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    use,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

const CloseHoverCardContext = createContext<() => void>(() => undefined);

/**
 * Closes the card a control is rendered inside. For a control that opens a
 * modal: the pointer never leaves a card an overlay covers, so it would stay.
 */
export function useCloseHoverCard(): () => void {
    return use(CloseHoverCardContext);
}

interface AppHoverCardProps extends Pick<
    PopoverProps,
    "position" | "arrowSize"
> {
    /** What is hovered or tapped. Wrapped, so it need not take a ref. */
    target: ReactNode;
    /** The card's content. */
    children: ReactNode;
    /** @default "md" */
    padding?: string;
    /** @default 0 */
    openDelay?: number;
    /** @default 150 */
    closeDelay?: number;
}

/**
 * A card that opens on hover and on a click or tap, which is the only way to
 * reach one on a touchscreen. A click pins it open until clicked again or
 * dismissed, so a mouse leaving it does not close what was asked for.
 *
 * The click is kept from the row underneath: Mantine's `HoverCard` opens on
 * the mouse events a tap emulates and lets the tap through, so on a phone the
 * same tap opened the card and the row.
 */
/**
 * For what is portaled out of the row: React bubbles through the portal, so a
 * click on the card or its overlay would otherwise reach the row too.
 */
const stopPropagation = (event: MouseEvent) => event.stopPropagation();

export function AppHoverCard(props: AppHoverCardProps): ReactNode {
    const {
        target,
        children,
        padding = "md",
        openDelay = 0,
        closeDelay = 150,
        ...popoverProps
    } = props;
    const [opened, setOpened] = useState(false);
    const [pinned, setPinned] = useState(false);
    // Outlives the pin until the card has faded out: a tap's click arrives
    // after the touchstart that closed the card, and has to land here too.
    const [overlaid, setOverlaid] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const close = useCallback(() => {
        window.clearTimeout(timer.current);
        setOpened(false);
        setPinned(false);
    }, []);

    const schedule = (next: boolean, delay: number) => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpened(next), delay);
    };

    // Hover is a mouse's alone: a touch's pointer events arrive with its tap,
    // and the click that follows decides.
    const handleEnter = (event: PointerEvent) => {
        if (event.pointerType === "mouse") {
            schedule(true, openDelay);
        }
    };

    const handleLeave = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && !pinned) {
            schedule(false, closeDelay);
        }
    };

    const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        if (pinned) {
            close();
        } else {
            window.clearTimeout(timer.current);
            setOpened(true);
            setPinned(true);
            setOverlaid(true);
        }
    };

    return (
        <Popover
            {...popoverProps}
            opened={opened}
            // A click outside or Escape, whichever pinned it.
            onDismiss={close}
            // Invisible, and only for a pinned card: the tap that dismisses it
            // lands here rather than opening whatever row is underneath. A
            // hovered card has none, since the pointer leaving it is what
            // closes it.
            withOverlay={overlaid}
            overlayProps={{
                backgroundOpacity: 0,
                onClick: stopPropagation
            }}
            onExitTransitionEnd={() => setOverlaid(false)}
            // Across as well as along, so a card beside a row on a phone is
            // pushed back on screen rather than cut off at its edge.
            middlewares={{ flip: true, shift: { crossAxis: true, padding: 8 } }}
            withinPortal
            shadow="md"
            withArrow
        >
            <Popover.Target>
                <Box
                    component="span"
                    display="inline-flex"
                    onPointerEnter={handleEnter}
                    onPointerLeave={handleLeave}
                    onClick={handleClick}
                >
                    {target}
                </Box>
            </Popover.Target>
            <Popover.Dropdown
                p={padding}
                maw="calc(100vw - 16px)"
                onPointerEnter={handleEnter}
                onPointerLeave={handleLeave}
                onClick={stopPropagation}
            >
                <CloseHoverCardContext value={close}>
                    {children}
                </CloseHoverCardContext>
            </Popover.Dropdown>
        </Popover>
    );
}
