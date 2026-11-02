import {
    Box,
    Divider,
    Group,
    Stack,
    Text,
    type MantineSize
} from "@mantine/core";
import { type ReactNode } from "react";
import { FontWeight, StatusColor } from "../lib/style-constants";
import { AppHoverCard } from "./app-hover-card";

/** Wide enough for a name and its value side by side. */
const BUBBLE_WIDTH = 300;

interface AppHoverBubbleProps {
    /** The row's icon, hovered or tapped to open the bubble. */
    target: ReactNode;
    /** Left out where the body says what it is on its own. */
    header?: BubbleHeaderProps;
    /** Set when the body holds controls. */
    interactive?: boolean;
    /** Ruled off from the header. */
    children?: ReactNode;
    /** Around the whole bubble. @default "md" */
    padding?: MantineSize;
    /** Under the target, for one inside another bubble, which fills the space to its right. */
    below?: boolean;
}

/**
 * A row icon's card about that row: a titled header, then a body. To the
 * right, sliding back into view rather than flipping over the row. With a
 * header it keeps one width whatever its body; without, it fits its body.
 */
export function AppHoverBubble(props: AppHoverBubbleProps): ReactNode {
    const { target, header, interactive, children, padding, below } = props;

    return (
        <AppHoverCard
            position={below ? "bottom" : "right"}
            middlewares={
                below ? undefined : { flip: false, shift: { crossAxis: true } }
            }
            arrowSize={20}
            // Passing the pointer down a list shouldn't open every row's.
            openDelay={150}
            interactive={interactive}
            target={target}
            padding={padding}
        >
            <Stack gap="sm" w={header && BUBBLE_WIDTH} maw={BUBBLE_WIDTH}>
                {header && <BubbleHeader {...header} />}
                {header && children && <Divider />}
                {children}
            </Stack>
        </AppHoverCard>
    );
}

interface BubbleHeaderProps {
    /** The target's icon at `IconSize.CONTROL`, beside the title. */
    icon: ReactNode;
    title: string;
    /** Beside the title, at the bubble's edge. */
    rightSection?: ReactNode;
    /** Under the title: badges summing up the body. */
    subtitle?: ReactNode;
}

function BubbleHeader(props: BubbleHeaderProps): ReactNode {
    const { icon, title, rightSection, subtitle } = props;
    return (
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
    );
}

interface HoverBubbleRowProps {
    label: string;
    /** Under the label, dimmed: what a setting does. */
    description?: string;
    /** Right-aligned beside the label: a value, or a control. */
    children: ReactNode;
}

/** A label and its value or control across a bubble's body. */
export function HoverBubbleRow(props: HoverBubbleRowProps): ReactNode {
    const { label, description, children } = props;
    return (
        <Group gap="md" justify="space-between">
            <Box miw={0}>
                <Text>{label}</Text>
                {description && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {description}
                    </Text>
                )}
            </Box>
            {children}
        </Group>
    );
}
