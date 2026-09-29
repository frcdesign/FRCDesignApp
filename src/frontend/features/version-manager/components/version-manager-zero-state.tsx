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
import { AddLinkField } from "./add-link-input";

/** The line the diagram is drawn in, matching the edge of a card. */
const BORDER = "1px solid var(--mantine-color-default-border)";

/** The corner it turns, matching the theme's default. */
const RADIUS = "var(--mantine-radius-sm)";

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

/**
 * What the page is before anything is linked: nothing to push, nothing to pull,
 * and two empty lists would say neither what this is for nor what to do about
 * it. The field is here rather than in the lists below, because linking one
 * document is the whole of getting started.
 */
export function VersionManagerZeroState(
    props: VersionManagerZeroStateProps
): ReactNode {
    return (
        // One column for the whole welcome, so the text, the picture and the
        // card share their edges: this decides the width, and each fills it.
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
                description="Version manager lets you automatically push and pull versions between Onshape documents. To get started, paste the link of another associated Onshape document."
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

/**
 * How wide the welcome gets: the measure Mantine already caps a notice's
 * description at, so the picture and the card end where its lines do.
 */
const COLUMN_WIDTH = "32rem";

/** Short of the panel's edges, so the card still reads as a card there. */
const COLUMN_SHARE = "90%";

interface AddFirstLinkCardProps {
    workspace: WorkspacePath;
    documentName: string;
}

/**
 * Linking a document is two answers — which way round it goes, and which
 * document — so they are asked together, in one card, in that order.
 */
function AddFirstLinkCard(props: AddFirstLinkCardProps): ReactNode {
    const { workspace, documentName } = props;
    // A parent by default, which is the document the welcome text describes:
    // one this document already uses.
    const [direction, setDirection] = useState<LinkDirection>(
        LinkDirection.PARENT
    );

    return (
        // Left, where the notice above it is centred: this is a form, and a
        // centred label over a field reads as a heading for the whole card.
        <Card withBorder radius="md" ta="left">
            <Stack gap="md">
                <Radio.Group
                    value={direction}
                    onChange={setDirection}
                    label="The document I'm linking to is..."
                >
                    <SimpleGrid cols={2} spacing="xs" mt={6}>
                        <DirectionCard
                            direction={LinkDirection.PARENT}
                            selected={direction === LinkDirection.PARENT}
                            documentName={documentName}
                        />
                        <DirectionCard
                            direction={LinkDirection.CHILD}
                            selected={direction === LinkDirection.CHILD}
                            documentName={documentName}
                        />
                    </SimpleGrid>
                </Radio.Group>
                <AddLinkField workspace={workspace} direction={direction} />
            </Stack>
        </Card>
    );
}

/** Mantine's card carries the border; what being picked looks like is ours. */
const SELECTED_CARD = {
    borderColor: PrimaryColor.FILLED,
    backgroundColor: PrimaryColor.LIGHT
};

interface DirectionCardProps {
    direction: LinkDirection;
    selected: boolean;
    documentName: string;
}

/**
 * One of the two things the pasted document can be. Both descriptions stay on
 * the page rather than swapping with the choice: which one is wanted is the
 * question, and it cannot be answered by the half of the answer showing.
 */
function DirectionCard(props: DirectionCardProps): ReactNode {
    const { direction, selected, documentName } = props;
    const choice = DIRECTION_CHOICE[direction];

    return (
        // A grid of one, so the notice fills the card rather than sitting in
        // the middle of it: Radio.Card is a button, and a button centres its
        // content in whatever height the taller card gives the row.
        <Radio.Card
            withBorder
            display="grid"
            px="sm"
            radius="sm"
            value={direction}
            style={selected ? SELECTED_CARD : undefined}
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

/** A robot assembled from three subsystems, each in a document of its own,
 * which is the arrangement version manager is for. */
const EXAMPLE_PARENTS = ["Intake", "Drivetrain", "Shooter"];
const EXAMPLE_CHILD = "Robot";

/** The room between two documents in the picture. */
const DOCUMENT_GAP = 20;

/** Where an outer column's middle falls: the connector is drawn across the
 * whole diagram rather than inside the grid, so it is told where to join. */
const OUTER_COLUMN_CENTER = `calc((100% - ${2 * DOCUMENT_GAP}px) / 6)`;

/** How far the connector drops before it turns in, and how far after. */
const ELBOW_HEIGHT = 16;
const TRUNK_HEIGHT = 18;

const ARROW_WIDTH = 9;
const ARROW_HEIGHT = 7;

/** The color {@link BORDER} draws in, for the arrowhead, which is a filled
 * triangle rather than a rule. */
const LINE_COLOR = "var(--mantine-color-default-border)";

/**
 * What a link is, drawn: three subsystem documents, and the robot that uses all
 * three. Which way round a pair goes is the thing to have right before pasting
 * one in, and a picture says it in less room than the paragraph did.
 */
function LinkExampleDiagram(): ReactNode {
    return (
        // The labels are outside the rows rather than beside the arrow, which
        // is where they would break the line they are labelling.
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
                {/* The middle column, so the robot is the width of one of the
                    documents above it rather than of all three. */}
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

/** One document in the picture; all four boxes are the same box. */
function ExampleDocument(props: ExampleDocumentProps): ReactNode {
    return (
        <Paper withBorder radius="sm" py={6} px="sm">
            <Text size="sm" fw={FontWeight.SEMI_BOLD} ta="center" truncate>
                {props.name}
            </Text>
        </Paper>
    );
}

interface DiagramLabelProps {
    children: string;
}

/** Which end of a link the row it sits against is. Set as a label rather
 * than as prose, so it does not read as another line of the welcome text. */
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

/**
 * The bracket under the three documents: each drops, turns in, and meets the
 * line that carries the arrow down to the child.
 *
 * The arrowhead is the usual CSS triangle — a box with no size of its own and
 * three borders — so that its point lands exactly where the line stops, which
 * an icon, padded inside its own box, would only land near.
 */
function Connector(): ReactNode {
    return (
        <Box pos="relative" h={ELBOW_HEIGHT + TRUNK_HEIGHT}>
            <Box
                pos="absolute"
                top={0}
                h={ELBOW_HEIGHT}
                left={OUTER_COLUMN_CENTER}
                right="50%"
                style={{
                    borderLeft: BORDER,
                    borderBottom: BORDER,
                    borderBottomLeftRadius: RADIUS
                }}
            />
            <Box
                pos="absolute"
                top={0}
                h={ELBOW_HEIGHT}
                left="50%"
                right={OUTER_COLUMN_CENTER}
                style={{
                    borderRight: BORDER,
                    borderBottom: BORDER,
                    borderBottomRightRadius: RADIUS
                }}
            />
            {/* The middle document's drop, carrying on through the bracket. */}
            <Box
                pos="absolute"
                top={0}
                bottom={0}
                left="50%"
                style={{ borderLeft: BORDER, transform: "translateX(-50%)" }}
            />
            <Box
                pos="absolute"
                bottom={0}
                left="50%"
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: `${ARROW_WIDTH / 2}px solid transparent`,
                    borderRight: `${ARROW_WIDTH / 2}px solid transparent`,
                    borderTop: `${ARROW_HEIGHT}px solid ${LINE_COLOR}`,
                    transform: "translateX(-50%)"
                }}
            />
        </Box>
    );
}
