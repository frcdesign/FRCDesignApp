import { AppLink } from "./app-link";
import { Divider, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { ArrowRightIcon, BooksIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { type AppTab, UtilityTab } from "../lib/app-tab";
import { AppBrandMark } from "./app-brand";
import { AppModal, AppModalBody } from "./app-modal";
import { AppIcon } from "./app-icon";
import { SectionNotice } from "./app-notice";
import { FontWeight, IconSize, StatusColor } from "../lib/style-constants";
import { getLibraryName } from "../lib/library";
import {
    getUtilityColor,
    getUtilityIcon,
    getUtilityName,
    useNavigateToTab
} from "../lib/tabs";
import { getLibraryShade, toShade } from "../theme";
import { updateUiState, useUiState } from "../lib/ui-state";
import { m } from "../paraglide/messages";
import styles from "../lib/styles.module.css";

interface Program {
    libraryId: LibraryId;
    /** What a team calls the program it competes in. */
    name: string;
}

/** What the app is offered for. MKCad is deprecated, so nobody is started in it. */
const PROGRAMS: Program[] = [
    { libraryId: LibraryId.FRC_DESIGN_LIB, name: "FRC" },
    { libraryId: LibraryId.CONFIG_LIB, name: "FTC" }
];

/** In the page picker's order. */
const UTILITIES: UtilityTab[] = [
    UtilityTab.FEATURESCRIPTS,
    UtilityTab.VERSION_MANAGER,
    UtilityTab.AUTO_ASSEMBLY
];

/** FIRST's own site, which their notice has to name. */
const FIRST_URL = "https://www.firstinspires.org";

function describeUtility(tab: UtilityTab): string {
    switch (tab) {
        case UtilityTab.VERSION_MANAGER:
            return m.welcomeVersionManagerDescription();
        case UtilityTab.AUTO_ASSEMBLY:
            return m.welcomeAutoAssemblyDescription();
        case UtilityTab.FEATURESCRIPTS:
            return m.welcomeFeatureScriptsDescription();
    }
}

/** The registration these names carry, raised off the name it follows. */
function RegisteredMark(): ReactNode {
    return <sup>&reg;</sup>;
}

interface ProgramCardProps {
    program: Program;
    onSelect: (tabId: AppTab) => void;
}

/** One program to pick, named the way its teams do, over the library it opens. */
function ProgramCard(props: ProgramCardProps): ReactNode {
    const { program, onSelect } = props;
    const { libraryId, name } = program;
    const shade = getLibraryShade(libraryId);

    return (
        <UnstyledButton
            className={`interactive ${styles.outlined}`}
            p="md"
            onClick={() => {
                onSelect(libraryId);
            }}
        >
            <Group gap="md">
                {/* In the library's own color, so the two choices read as the
                    two libraries they open. */}
                <AppIcon
                    icon={BooksIcon}
                    size={IconSize.SECTION}
                    color={shade}
                />
                <Stack gap={2} flex={1} miw={0} ta="left">
                    <Text size="xl" fw={FontWeight.BOLD} c={shade}>
                        {name}
                        <RegisteredMark />
                    </Text>
                    <Text>{getLibraryName(libraryId)}</Text>
                </Stack>
                <ArrowRightIcon size={IconSize.MEDIUM} />
            </Group>
        </UnstyledButton>
    );
}

interface UtilityCardProps {
    tab: UtilityTab;
    onSelect: (tabId: AppTab) => void;
}

/** A page that is not a library, smaller than a program so the program reads as the choice to make. */
function UtilityCard(props: UtilityCardProps): ReactNode {
    const { tab, onSelect } = props;

    return (
        <UnstyledButton
            className={`interactive ${styles.outlined}`}
            px="md"
            py="sm"
            onClick={() => {
                onSelect(tab);
            }}
        >
            <Group gap="md" wrap="nowrap">
                <AppIcon
                    icon={getUtilityIcon(tab)}
                    size={IconSize.CONTROL}
                    color={toShade(getUtilityColor(tab))}
                />
                <Stack gap={0} flex={1} miw={0} ta="left">
                    <Text fw={FontWeight.BOLD}>{getUtilityName(tab)}</Text>
                    <Text size="sm" c={StatusColor.DIMMED}>
                        {describeUtility(tab)}
                    </Text>
                </Stack>
                <ArrowRightIcon size={IconSize.SMALL} />
            </Group>
        </UnstyledButton>
    );
}

/** FIRST's required notice, under the two names it covers. */
function TrademarkDisclaimer(): ReactNode {
    return (
        <Text size="xs" c={StatusColor.DIMMED} ta="center">
            FRC
            <RegisteredMark /> and FTC
            <RegisteredMark /> are registered trademarks of{" "}
            <Text component="span" inherit fs="italic">
                FIRST
            </Text>
            <RegisteredMark /> (
            <AppLink href={FIRST_URL} inherit withIcon={false}>
                www.firstinspires.org
            </AppLink>
            ) which is not overseeing, involved with, or responsible for this
            activity, product, or service.
        </Text>
    );
}

/**
 * Asks a new user's program, which becomes their tab, and shows the utilities
 * beside it, any of which can be the tab instead. Asked once per browser.
 */
export function Welcome(): ReactNode {
    const tabId = useUiState((state) => state.tabId);
    const navigateToTab = useNavigateToTab();

    const selectTab = (tabId: AppTab) => {
        updateUiState({ tabId });
        navigateToTab(tabId);
    };

    return (
        <AppModal opened={tabId === undefined} dismissible={false} size="lg">
            <AppModalBody>
                <SectionNotice
                    icon={<AppBrandMark size={IconSize.PAGE} />}
                    title={m.welcomeTitle()}
                    description={m.welcomeDescription()}
                    action={
                        // Side by side, each would be narrower than its name in Onshape's panel.
                        <Stack gap="sm" w="100%" maw={320}>
                            {PROGRAMS.map((program) => (
                                <ProgramCard
                                    key={program.libraryId}
                                    program={program}
                                    onSelect={selectTab}
                                />
                            ))}
                            <Divider
                                label={m.welcomeUtilities()}
                                labelPosition="center"
                            />
                            {UTILITIES.map((tab) => (
                                <UtilityCard
                                    key={tab}
                                    tab={tab}
                                    onSelect={selectTab}
                                />
                            ))}
                        </Stack>
                    }
                />
                <TrademarkDisclaimer />
            </AppModalBody>
        </AppModal>
    );
}
