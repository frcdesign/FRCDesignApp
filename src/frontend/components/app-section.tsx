import { Accordion, ActionIcon, Group } from "@mantine/core";
import { CaretDownIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";
import { AppTitle } from "./app-title";
import styles from "../lib/styles.module.css";
import classes from "./app-section.module.css";

interface AppSectionsProps {
    /** The values of the sections showing their content. */
    opened: string[];
    onChange: (opened: string[]) => void;
    children: ReactNode;
}

/**
 * A page's stack of collapsing sections, each opening and closing on its own.
 * Which are open belongs to the caller, since it usually outlives the page.
 *
 * The content is laid out flush to the page's edges: a section's rows sit on
 * the same grid as every other list in the app, so padding here would inset
 * them from it.
 */
export function AppSections(props: AppSectionsProps): ReactNode {
    const { opened, onChange, children } = props;

    return (
        <Accordion
            multiple
            variant="unstyled"
            value={opened}
            onChange={onChange}
            classNames={{
                item: classes.item,
                label: classes.label,
                content: `${classes.content} ${styles.dividerBottom}`,
                icon: styles.titleIcon,
                chevron: classes.chevron
            }}
        >
            {children}
        </Accordion>
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
    /** The section's own controls, between its title and its chevron. */
    actions?: ReactNode;
    opened: boolean;
    onToggle: () => void;
    children: ReactNode;
}

/**
 * One section. Its controls sit beside the header rather than inside it — a
 * button cannot be nested in a button — and the chevron comes after them, at
 * the end of the row.
 */
export function AppSection(props: AppSectionProps): ReactNode {
    const { value, name, title, icon, actions, opened, onToggle, children } =
        props;

    return (
        <Accordion.Item value={value}>
            <Group
                // The whole row highlights, not the control: the buttons and
                // the chevron beside it are part of the same header, and a
                // highlight that stopped where they begin would look like a
                // second thing had started there.
                className={`${classes.header} ${styles.sectionHeader} ${styles.dividerBottom} interactive`}
                gap="xs"
                wrap="nowrap"
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
                    name={name}
                    opened={opened}
                    onToggle={onToggle}
                />
            </Group>
            <Accordion.Panel>{children}</Accordion.Panel>
        </Accordion.Item>
    );
}

interface SectionChevronProps {
    name: string;
    opened: boolean;
    onToggle: () => void;
}

/**
 * The section's own chevron. Mantine's is hidden and this stands in for it, so
 * it lands at the end of the row rather than against the title.
 */
function SectionChevron(props: SectionChevronProps): ReactNode {
    const { name, opened, onToggle } = props;

    return (
        <ActionIcon
            variant="subtle"
            color={StatusColor.NEUTRAL}
            aria-label={`${opened ? "Collapse" : "Expand"} ${name}`}
            className={styles.noShrink}
            onClick={onToggle}
        >
            <CaretDownIcon
                size={IconSize.MEDIUM}
                style={{
                    transform: opened ? "rotate(180deg)" : undefined,
                    transition: "transform 200ms ease"
                }}
            />
        </ActionIcon>
    );
}
