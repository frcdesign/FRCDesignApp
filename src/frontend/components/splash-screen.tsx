import { AppLink } from "./app-link";
import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { ArrowRightIcon, BooksIcon, type Icon } from "@phosphor-icons/react";
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
import { Hint } from "@backend/features/hints/contract";
import { useHasSeenScreen, useMarkHintSeen } from "../features/hints/queries";
import { m } from "../paraglide/messages";
import styles from "../lib/styles.module.css";

interface LibraryChoice {
    libraryId: LibraryId;
    description: () => string;
}

/** What the app is offered for. MKCad is deprecated, so nobody is started in it. */
const LIBRARIES: LibraryChoice[] = [
    {
        libraryId: LibraryId.FRC_DESIGN_LIB,
        description: m.splashScreenFrcDesignLibDescription
    },
    {
        libraryId: LibraryId.CONFIG_LIB,
        description: m.splashScreenConfigLibDescription
    }
];

/** In the page picker's order. */
const UTILITIES: UtilityTab[] = [
    UtilityTab.FEATURESCRIPTS,
    UtilityTab.VERSION_MANAGER,
    UtilityTab.AUTO_ASSEMBLY,
    UtilityTab.MASS_ANALYSIS
];

/** FIRST's own site, which their notice has to name. */
const FIRST_URL = "https://www.firstinspires.org";

function describeUtility(tab: UtilityTab): string {
    switch (tab) {
        case UtilityTab.VERSION_MANAGER:
            return m.splashScreenVersionManagerDescription();
        case UtilityTab.AUTO_ASSEMBLY:
            return m.splashScreenAutoAssemblyDescription();
        case UtilityTab.FEATURESCRIPTS:
            return m.splashScreenFeatureScriptsDescription();
        case UtilityTab.MASS_ANALYSIS:
            return m.splashScreenMassAnalysisDescription();
    }
}

/** The registration these names carry, raised off the name it follows. */
function RegisteredMark(): ReactNode {
    return <sup>&reg;</sup>;
}

/** A message's ® raised, as FIRST's names carry it. */
function withRegisteredMarks(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let start = 0;
    for (const match of text.matchAll(/®/g)) {
        nodes.push(
            text.slice(start, match.index),
            <RegisteredMark key={match.index} />
        );
        start = match.index + 1;
    }
    nodes.push(text.slice(start));
    return nodes;
}

interface PageCardProps {
    tab: AppTab;
    icon: Icon;
    /** A Mantine shade, which the icon takes. */
    shade: string;
    name: string;
    description: ReactNode;
    onSelect: (tabId: AppTab) => void;
}

/** One page to start in: a library or a utility. */
function PageCard(props: PageCardProps): ReactNode {
    const { tab, icon, shade, name, description, onSelect } = props;

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
                <AppIcon icon={icon} size={IconSize.CONTROL} color={shade} />
                <Stack gap={0} flex={1} miw={0} ta="left">
                    <Text fw={FontWeight.BOLD}>{name}</Text>
                    <Text size="sm" c={StatusColor.DIMMED}>
                        {description}
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
 * Asks which library or utility to start in, which becomes the tab. Shown once
 * to everybody; somebody with a tab already can close it.
 */
export function SplashScreen(): ReactNode {
    const tabId = useUiState((state) => state.tabId);
    const hasSeen = useHasSeenScreen(Hint.SAW_SPLASH_SCREEN);
    const markSeen = useMarkHintSeen(Hint.SAW_SPLASH_SCREEN);
    const navigateToTab = useNavigateToTab();

    const selectTab = (tabId: AppTab) => {
        markSeen();
        updateUiState({ tabId });
        navigateToTab(tabId);
    };

    return (
        <AppModal
            opened={tabId === undefined || !hasSeen}
            onClose={markSeen}
            dismissible={tabId !== undefined}
            size="lg"
        >
            <AppModalBody>
                <SectionNotice
                    icon={<AppBrandMark size={IconSize.PAGE} />}
                    title={m.splashScreenTitle()}
                    action={
                        // Side by side, each would be narrower than its description in Onshape's panel.
                        <Stack gap="sm" w="100%" maw={320}>
                            {LIBRARIES.map(({ libraryId, description }) => (
                                <PageCard
                                    key={libraryId}
                                    tab={libraryId}
                                    icon={BooksIcon}
                                    shade={getLibraryShade(libraryId)}
                                    name={getLibraryName(libraryId)}
                                    description={withRegisteredMarks(
                                        description()
                                    )}
                                    onSelect={selectTab}
                                />
                            ))}
                            {UTILITIES.map((tab) => (
                                <PageCard
                                    key={tab}
                                    tab={tab}
                                    icon={getUtilityIcon(tab)}
                                    shade={toShade(getUtilityColor(tab))}
                                    name={getUtilityName(tab)}
                                    description={describeUtility(tab)}
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
