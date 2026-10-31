import { Divider, Group, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { FontWeight } from "../lib/style-constants";
import { AppHoverCard } from "./app-hover-card";

/** Wide enough for a name and its value side by side. */
const BUBBLE_WIDTH = 300;

interface AppHoverBubbleProps {
    /** The row's icon, hovered or tapped to open the bubble. */
    target: ReactNode;
    /** The same icon at `IconSize.CONTROL`, beside the title. */
    icon: ReactNode;
    title: string;
    /** Beside the title, at the bubble's edge. */
    rightSection?: ReactNode;
    /** Under the title: badges summing up the body. */
    subtitle?: ReactNode;
    /** Set when the body holds controls. */
    interactive?: boolean;
    /** Ruled off from the header. */
    children?: ReactNode;
}

/**
 * A row icon's card about that row: a titled header, then a body. Always to
 * the right, sliding back into view rather than flipping over the row.
 */
export function AppHoverBubble(props: AppHoverBubbleProps): ReactNode {
    const {
        target,
        icon,
        title,
        rightSection,
        subtitle,
        interactive,
        children
    } = props;

    return (
        <AppHoverCard
            position="right"
            middlewares={{ flip: false, shift: { crossAxis: true } }}
            arrowSize={20}
            // Passing the pointer down a list shouldn't open every row's.
            openDelay={150}
            interactive={interactive}
            target={target}
        >
            <Stack gap="sm" w={BUBBLE_WIDTH}>
                <Stack gap={6}>
                    <Group gap="xs" wrap="nowrap">
                        {icon}
                        <Text
                            truncate
                            title={title}
                            fw={FontWeight.SEMI_BOLD}
                            flex={1}
                            miw={0}
                        >
                            {title}
                        </Text>
                        {rightSection}
                    </Group>
                    {subtitle}
                </Stack>
                {children && (
                    <>
                        <Divider />
                        {children}
                    </>
                )}
            </Stack>
        </AppHoverCard>
    );
}

interface HoverBubbleRowProps {
    label: string;
    /** Right-aligned beside the label. */
    children: ReactNode;
}

/** A label and its value across a bubble's body. */
export function HoverBubbleRow(props: HoverBubbleRowProps): ReactNode {
    const { label, children } = props;
    return (
        <Group gap="xl" justify="space-between">
            <Text>{label}</Text>
            {children}
        </Group>
    );
}
