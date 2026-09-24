import { ExternalLink } from "../../../components/external-link";
import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { ArrowRightIcon, BooksIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { type AppTab } from "@backend/features/settings/app-tab";
import { AppBrandMark } from "../../../components/app-brand";
import { AppModal, AppModalBody } from "../../../components/app-modal";
import { AppIcon } from "../../../components/app-icon";
import { SectionNotice } from "../../../components/app-notice";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { getLibraryName } from "../../../lib/library";
import { useNavigateToTab } from "../../../lib/tabs";
import { getLibraryShade } from "../../../theme";
import { updateUiState, useGetUiState } from "../../../lib/ui-state";
import styles from "../../../lib/styles.module.css";

interface Program {
    libraryId: LibraryId;
    /** What a team calls the program it competes in. */
    name: string;
}

/** What the app is offered for. MKCad is deprecated, so nobody is started in it. */
const PROGRAMS: Program[] = [
    { libraryId: LibraryId.FRC_DESIGN_LIB, name: "FRC" },
    { libraryId: LibraryId.FTC_DESIGN_LIB, name: "FTC" }
];

/** FIRST's own site, which their notice has to name. */
const FIRST_URL = "https://www.firstinspires.org";

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
            <ExternalLink href={FIRST_URL} inherit>
                www.firstinspires.org
            </ExternalLink>
            ) which is not overseeing, involved with, or responsible for this
            activity, product, or service.
        </Text>
    );
}

/** Asks a new user's program, which becomes their tab. Synced, so asked once per account. */
export function ProgramSelect(): ReactNode {
    const { tabId } = useGetUiState();
    const navigateToTab = useNavigateToTab();

    const selectTab = (tabId: AppTab) => {
        updateUiState({ tabId });
        navigateToTab(tabId);
    };

    return (
        <AppModal opened={tabId === null} dismissible={false} size="lg">
            <AppModalBody>
                <SectionNotice
                    icon={<AppBrandMark size={IconSize.PAGE} />}
                    title="Welcome to the FRCDesignApp!"
                    description="To get started, select your library. You can switch between libraries at any time using the top navbar."
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
                        </Stack>
                    }
                />
                <TrademarkDisclaimer />
            </AppModalBody>
        </AppModal>
    );
}
