import { Accordion, Box, Group, Title } from "@mantine/core";
import { CaretDownIcon } from "@phosphor-icons/react";
import { createContext, use, type ReactNode } from "react";
import { IconSize } from "../lib/style-constants";
import { AppTitle } from "./app-title";
import { PANEL_TITLE_ORDER } from "./section";
import styles from "../lib/styles.module.css";
import classes from "./app-section.module.css";

interface AppSectionsProps {
    /** The values of the sections showing their content. */
    opened: string[];
    onChange: (opened: string[]) => void;
    /** Inside a card: tighter, not stuck, and unmounted while closed. */
    compact?: boolean;
    children: ReactNode;
}

interface SectionsContextValue {
    opened: string[];
    onChange: (opened: string[]) => void;
    compact: boolean;
}

/** Lets each section's chevron toggle itself without the caller wiring it. */
const SectionsContext = createContext<SectionsContextValue>({
    opened: [],
    onChange: () => undefined,
    compact: false
});

/**
 * A stack of collapsing sections. Which are open belongs to the caller, since
 * it usually outlives the page. On a page, flush to its edges, so a section's
 * rows sit on the same grid as every other list.
 */
export function AppSections(props: AppSectionsProps): ReactNode {
    const { opened, onChange, compact = false, children } = props;

    return (
        <SectionsContext value={{ opened, onChange, compact }}>
            <Accordion
                multiple
                variant="unstyled"
                value={opened}
                onChange={onChange}
                // A closed card section's content fetches nothing.
                keepMounted={!compact}
                chevronPosition="right"
                chevron={<CaretDownIcon size={IconSize.SMALL} />}
                classNames={{
                    item: classes.item,
                    control: compact ? classes.compactControl : undefined,
                    label: classes.label,
                    content: compact
                        ? classes.compactContent
                        : `${classes.content} ${styles.dividerBottom}`,
                    icon: styles.titleIcon,
                    chevron: compact ? undefined : classes.chevron
                }}
            >
                {children}
            </Accordion>
        </SectionsContext>
    );
}

interface AppSectionProps {
    /** Identifies the section to {@link AppSections}. */
    value: string;
    /** Names the section, and titles it where `title` is left out. */
    name: string;
    /** A title of its own, for a section whose header carries more than a name. */
    title?: ReactNode;
    icon?: ReactNode;
    /**
     * Between the title and the chevron. In a compact section it sits inside the
     * header's button, so it must not be a control itself.
     */
    actions?: ReactNode;
    children: ReactNode;
}

/** One section. Its controls sit beside the header: a button cannot nest in a button. */
export function AppSection(props: AppSectionProps): ReactNode {
    const { value, name, title, icon, actions, children } = props;
    const sections = use(SectionsContext);
    const opened = sections.opened.includes(value);

    if (sections.compact) {
        return (
            <Accordion.Item value={value}>
                <Accordion.Control icon={icon}>
                    <Group gap="xs" wrap="nowrap" justify="space-between">
                        {title ?? (
                            <Title order={PANEL_TITLE_ORDER}>{name}</Title>
                        )}
                        {actions}
                    </Group>
                </Accordion.Control>
                <Accordion.Panel>{children}</Accordion.Panel>
            </Accordion.Item>
        );
    }

    const toggle = () =>
        sections.onChange(
            opened
                ? sections.opened.filter((each) => each !== value)
                : [...sections.opened, value]
        );

    return (
        <Accordion.Item value={value}>
            <Group
                // The whole row highlights, buttons and chevron included.
                className={`${classes.header} ${styles.sectionHeader} ${styles.dividerBottom} interactive`}
                gap="xs"
                pr="sm"
            >
                <Accordion.Control
                    // Shrinkable, so the buttons beside it keep their width.
                    miw={0}
                    icon={icon}
                >
                    {title ?? <AppTitle title={name} />}
                </Accordion.Control>
                {actions}
                <SectionChevron
                    opened={opened}
                    onToggle={toggle}
                    size={IconSize.MEDIUM}
                />
            </Group>
            <Accordion.Panel>{children}</Accordion.Panel>
        </Accordion.Item>
    );
}

interface SectionChevronProps {
    opened: boolean;
    onToggle: () => void;
    size: IconSize;
}

/**
 * Mantine's chevron sits inside the control, before the actions; this one
 * lands at the end of the row, and like Mantine's is part of the header rather
 * than a button of its own.
 */
function SectionChevron(props: SectionChevronProps): ReactNode {
    const { opened, onToggle, size } = props;

    return (
        <Box
            className={`${classes.toggle} ${styles.noShrink}`}
            data-opened={opened || undefined}
            onClick={onToggle}
        >
            <CaretDownIcon size={size} />
        </Box>
    );
}
