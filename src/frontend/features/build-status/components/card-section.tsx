import { Divider } from "@mantine/core";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { AppSection, AppSections } from "../../../components/app-section";
import {
    SectionId,
    setOpenedSections,
    useOpenedSections
} from "../../../lib/ui-state";

const CARD_SECTION_IDS = [
    SectionId.BUILD_CHECKS,
    SectionId.SETTINGS,
    SectionId.ACTIONS,
    SectionId.CONFIGURATION,
    SectionId.USAGE
];

interface CardSectionsProps {
    /** Each a keyed {@link CardSection}, or a component that renders one. */
    sections: ReactElement[];
}

/**
 * The card's sections, ruled apart. Open or closed on every card at once, and
 * remembered, since an editor checks many in a row.
 */
export function CardSections(props: CardSectionsProps): ReactNode {
    const { sections } = props;
    const opened = useOpenedSections(CARD_SECTION_IDS);
    return (
        <AppSections
            compact
            opened={opened}
            onChange={(next) => setOpenedSections(CARD_SECTION_IDS, next)}
        >
            {sections.map((section, index) => (
                <Fragment key={section.key}>
                    {index > 0 && <Divider my="sm" />}
                    {section}
                </Fragment>
            ))}
        </AppSections>
    );
}

interface CardSectionProps {
    id: SectionId;
    title: string;
    /** Beside the header's button, before the chevron: a control, or what the closed section holds. */
    actions?: ReactNode;
    children: ReactNode;
}

/** One of {@link CardSections}. Unmounted while closed, so nothing in it fetches. */
export function CardSection(props: CardSectionProps): ReactNode {
    const { id, title, actions, children } = props;
    return (
        <AppSection value={id} name={title} actions={actions}>
            {children}
        </AppSection>
    );
}
