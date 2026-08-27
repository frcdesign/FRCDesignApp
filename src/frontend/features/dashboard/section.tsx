import { Card, Stack, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";

/**
 * A titled run of the page, with the window it covers stated beneath.
 *
 * Cards are opinionated about their own timeframe rather than following a
 * page-wide picker, which only works if each one says which timeframe that is.
 */
export function Section({
    title,
    window,
    children
}: {
    title: string;
    /** e.g. "Last 28 days" or "All time". */
    window?: string;
    children: ReactNode;
}): ReactNode {
    return (
        <Stack gap="sm">
            <SectionHeading title={title} window={window} order={3} />
            {children}
        </Stack>
    );
}

/** The same heading in a card, for a section that is one chart or table. */
export function SectionCard({
    title,
    window,
    children
}: {
    title: string;
    window?: string;
    children: ReactNode;
}): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <SectionHeading title={title} window={window} order={4} />
            {children}
        </Card>
    );
}

function SectionHeading({
    title,
    window,
    order
}: {
    title: string;
    window?: string;
    order: 3 | 4;
}): ReactNode {
    return (
        <div style={{ marginBottom: "var(--mantine-spacing-md)" }}>
            <Title order={order}>{title}</Title>
            {window && (
                <Text size="xs" c="dimmed">
                    {window}
                </Text>
            )}
        </div>
    );
}
