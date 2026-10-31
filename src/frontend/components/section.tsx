import {
    ActionIcon,
    Box,
    Card,
    Collapse,
    Group,
    Stack,
    Title,
    UnstyledButton,
    type TitleOrder
} from "@mantine/core";
import { CaretDownIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";

/** A section's title inside a popover or menu: the size of the text under it, set apart by weight. */
export const PANEL_TITLE_ORDER: TitleOrder = 6;

interface SectionProps {
    title: string;
    /** {@link PANEL_TITLE_ORDER} inside a popover or menu. @default 3 */
    order?: TitleOrder;
    children: ReactNode;
}

/** A titled run of a page or a menu. */
export function Section({
    title,
    order = 3,
    children
}: SectionProps): ReactNode {
    return (
        <Stack gap="sm">
            <Title order={order}>{title}</Title>
            {children}
        </Stack>
    );
}

interface CollapsibleSectionProps {
    title: string;
    opened: boolean;
    onToggle: () => void;
    /** Beside the title, before the chevron: a link, or what the closed section holds. */
    actions?: ReactNode;
    children: ReactNode;
}

/**
 * A {@link Section} in a popover that folds away, with its chevron at the end of
 * the row as an `AppSection`'s is. Unmounted while closed, so nothing in it fetches.
 */
export function CollapsibleSection(props: CollapsibleSectionProps): ReactNode {
    const { title, opened, onToggle, actions, children } = props;
    return (
        <Stack gap={0}>
            <Group gap="xs">
                <UnstyledButton onClick={onToggle} flex={1} miw={0}>
                    <Title order={PANEL_TITLE_ORDER}>{title}</Title>
                </UnstyledButton>
                {actions}
                <ActionIcon
                    size="sm"
                    onClick={onToggle}
                    className={styles.noShrink}
                >
                    <CaretDownIcon
                        size={IconSize.SMALL}
                        style={{
                            transform: opened ? "rotate(180deg)" : undefined,
                            transition: "transform 200ms ease"
                        }}
                    />
                </ActionIcon>
            </Group>
            <Collapse expanded={opened} keepMounted={false}>
                <Box pt="sm">{children}</Box>
            </Collapse>
        </Stack>
    );
}

interface SectionCardProps {
    title: string;
    children: ReactNode;
}

/** A section whose content is one card: a chart, a table, a breakdown. */
export function SectionCard({ title, children }: SectionCardProps): ReactNode {
    return (
        <Section title={title}>
            <Card>{children}</Card>
        </Section>
    );
}
