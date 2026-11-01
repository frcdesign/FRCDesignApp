import {
    Box,
    Collapse,
    Divider,
    Group,
    Stack,
    Title,
    UnstyledButton
} from "@mantine/core";
import { ReactNode } from "react";
import { SectionChevron } from "../../../components/app-section";
import { PANEL_TITLE_ORDER } from "../../../components/section";
import {
    SectionId,
    setSectionOpened,
    useSectionOpened
} from "../../../lib/ui-state";

interface CardSectionProps {
    id: SectionId;
    title: string;
    /** Beside the title, before the chevron: a link, or what the closed section holds. */
    actions?: ReactNode;
    children: ReactNode;
}

/**
 * A titled section of the card that folds away, its chevron at the end of the
 * row as an `AppSection`'s is. Open or closed on every card at once, and
 * remembered, since an editor checks many in a row. Unmounted while closed, so
 * nothing in it fetches.
 */
export function CardSection(props: CardSectionProps): ReactNode {
    const { id, title, actions, children } = props;
    const opened = useSectionOpened(id);

    const toggle = () => setSectionOpened(id, !opened);

    return (
        <>
            <Divider />
            <Stack gap={0}>
                <Group gap="xs">
                    <UnstyledButton onClick={toggle} flex={1} miw={0}>
                        <Title order={PANEL_TITLE_ORDER}>{title}</Title>
                    </UnstyledButton>
                    {actions}
                    <SectionChevron
                        opened={opened}
                        onToggle={toggle}
                        size="sm"
                    />
                </Group>
                <Collapse expanded={opened} keepMounted={false}>
                    <Box pt="sm">{children}</Box>
                </Collapse>
            </Stack>
        </>
    );
}
