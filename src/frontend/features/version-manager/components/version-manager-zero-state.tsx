import {
    Box,
    Card,
    Paper,
    Radio,
    SimpleGrid,
    Stack,
    Text
} from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    TreeStructureIcon
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { PageNotice, SectionNotice } from "../../../components/app-notice";
import {
    FontWeight,
    IconSize,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { AddLinkInput } from "./add-link-input";
import classes from "./version-manager-zero-state.module.css";

/**
 * What each direction is called, what picking it would mean, and the arrow that
 * runs it: down for what this document pulls in, up for what it pushes out.
 */
const DIRECTION_CHOICE = {
    [LinkDirection.PARENT]: {
        label: "A parent",
        icon: ArrowLineDownIcon,
        description: (documentName: string) =>
            `I want to pull changes from the linked document into this document (${documentName}).`
    },
    [LinkDirection.CHILD]: {
        label: "A child",
        icon: ArrowLineUpIcon,
        description: (documentName: string) =>
            `I want to push changes from this document (${documentName}) to the linked document.`
    }
} as const;

interface VersionManagerZeroStateProps {
    workspace: WorkspacePath;
    documentName: string;
}

/** The page before anything is linked, where linking one document is the whole of getting started. */
export function VersionManagerZeroState(
    props: VersionManagerZeroStateProps
): ReactNode {
    return (
        // One column, so the text, the picture and the card share their edges.
        <Box w={COLUMN_SHARE} maw={COLUMN_WIDTH} mx="auto">
            <PageNotice
                icon={
                    <AppIcon
                        icon={TreeStructureIcon}
                        size={IconSize.PAGE}
                        color={PrimaryColor.FILLED}
                    />
                }
                title="Welcome to Version Manager!"
                description="Version Manager lets you automatically push and pull versions between Onshape documents. To get started, paste the link of another associated Onshape document."
                action={
                    <Stack gap="lg" w="100%">
                        <LinkExampleDiagram />
                        <AddFirstLinkCard
                            workspace={props.workspace}
                            documentName={props.documentName}
                        />
                    </Stack>
                }
            />
        </Box>
    );
}

/** The measure Mantine caps a notice's description at. */
const COLUMN_WIDTH = "32rem";

/** Short of the panel's edges, so the card still reads as a card there. */
const COLUMN_SHARE = "90%";

interface AddFirstLinkCardProps {
    workspace: WorkspacePath;
    documentName: string;
}

function AddFirstLinkCard(props: AddFirstLinkCardProps): ReactNode {
    const { workspace, documentName } = props;
    const [direction, setDirection] = useState<LinkDirection>(
        LinkDirection.PARENT
    );

    return (
        // A centred label over a field reads as a heading for the whole card.
        <Card ta="left">
            <Stack gap="md">
                <Radio.Group
                    value={direction}
                    onChange={setDirection}
                    label="The document I'm linking to is..."
                >
                    <SimpleGrid cols={2} spacing="xs" mt={6}>
                        <DirectionCard
                            direction={LinkDirection.PARENT}
                            documentName={documentName}
                        />
                        <DirectionCard
                            direction={LinkDirection.CHILD}
                            documentName={documentName}
                        />
                    </SimpleGrid>
                </Radio.Group>
                <AddLinkInput workspace={workspace} direction={direction} />
            </Stack>
        </Card>
    );
}

interface DirectionCardProps {
    direction: LinkDirection;
    documentName: string;
}

function DirectionCard(props: DirectionCardProps): ReactNode {
    const { direction, documentName } = props;
    const choice = DIRECTION_CHOICE[direction];

    return (
        // A grid, so the notice fills the card: a button centres its content.
        <Radio.Card
            className={classes.directionCard}
            display="grid"
            px="sm"
            value={direction}
        >
            <SectionNotice
                align="left"
                py={12}
                icon={
                    <AppIcon
                        icon={choice.icon}
                        size={IconSize.SECTION}
                        color={PrimaryColor.FILLED}
                    />
                }
                title={choice.label}
                description={choice.description(documentName)}
            />
        </Radio.Card>
    );
}

const EXAMPLE_PARENTS = ["Intake", "Drivetrain", "Shooter"];
const EXAMPLE_CHILD = "Robot";

const DOCUMENT_GAP = 20;

/** What a link is, drawn: three subsystem documents, and the robot that uses all three. */
function LinkExampleDiagram(): ReactNode {
    return (
        <Stack gap={8}>
            <SimpleGrid cols={3} spacing={DOCUMENT_GAP}>
                {EXAMPLE_PARENTS.map((name) => (
                    <ExampleDocument key={name} name={name} />
                ))}
            </SimpleGrid>
            <DiagramLabel>Parents</DiagramLabel>
            <Connector />
            <DiagramLabel>Children</DiagramLabel>
            <SimpleGrid cols={3} spacing={DOCUMENT_GAP}>
                {/* The middle column, so the robot is one document wide. */}
                <Box style={{ gridColumnStart: 2 }}>
                    <ExampleDocument name={EXAMPLE_CHILD} />
                </Box>
            </SimpleGrid>
        </Stack>
    );
}

interface ExampleDocumentProps {
    name: string;
}

function ExampleDocument(props: ExampleDocumentProps): ReactNode {
    return (
        <Paper withBorder py={6} px="sm">
            <Text fw={FontWeight.SEMI_BOLD} ta="center" truncate>
                {props.name}
            </Text>
        </Paper>
    );
}

interface DiagramLabelProps {
    children: string;
}

function DiagramLabel(props: DiagramLabelProps): ReactNode {
    return (
        <Text
            size="xs"
            lh={1}
            fw={FontWeight.BOLD}
            c={StatusColor.DIMMED}
            ta="center"
        >
            {props.children}
        </Text>
    );
}

/** The bracket under the parents, carrying the arrow down to the child. */
function Connector(): ReactNode {
    return (
        <Box
            className={classes.connector}
            style={{ "--document-gap": `${DOCUMENT_GAP}px` }}
        >
            <Box className={classes.elbow} data-side="left" />
            <Box className={classes.elbow} data-side="right" />
            <Box className={classes.trunk} />
            <Box className={classes.arrow} />
        </Box>
    );
}
