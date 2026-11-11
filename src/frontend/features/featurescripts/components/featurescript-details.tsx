import {
    Button,
    Card,
    Center,
    Group,
    Image,
    Stack,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import {
    ArrowLeftIcon,
    ArrowSquareOutIcon,
    PlusIcon,
    PuzzlePieceIcon
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { IconSize, RENDER_BACKGROUND } from "../../../lib/style-constants";
import { openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";
import {
    useAddFeatureScriptMutation,
    useCannotAddReason,
    useExampleUrl
} from "../queries";
import { FeatureScriptBadges } from "./featurescript-badges";
import { FeatureScriptIcon } from "./featurescript-icon";

/** The hero's height, the stored large thumbnail's. */
const HERO_HEIGHT = 300;

interface FeatureScriptHeroProps {
    feature: FeatureScriptOut;
}

/** The example's thumbnail across the top, or the generic image without one. */
function FeatureScriptHero(props: FeatureScriptHeroProps): ReactNode {
    const { feature } = props;
    return (
        <Card p="xs" radius="sm" bg={RENDER_BACKGROUND}>
            <Center h={HERO_HEIGHT}>
                {feature.thumbnailUrls ? (
                    <Image
                        src={feature.thumbnailUrls.large}
                        h={HERO_HEIGHT}
                        w="auto"
                        fit="contain"
                        alt=""
                    />
                ) : (
                    <Stack align="center" gap="xs">
                        <PuzzlePieceIcon size={IconSize.PAGE} />
                        <Text c="dimmed" size="sm">
                            {m.featureScriptsNoExample()}
                        </Text>
                    </Stack>
                )}
            </Center>
        </Card>
    );
}

interface FeatureScriptDetailsProps {
    feature: FeatureScriptOut;
}

export function FeatureScriptDetails(
    props: FeatureScriptDetailsProps
): ReactNode {
    const { feature } = props;
    const add = useAddFeatureScriptMutation(feature);
    const cannotAddReason = useCannotAddReason();
    const exampleUrl = useExampleUrl(feature);

    return (
        <Stack gap="md" p="sm">
            <Button
                component={Link}
                to="/app/featurescripts"
                variant="subtle"
                size="compact-sm"
                leftSection={<ArrowLeftIcon />}
                mr="auto"
            >
                {m.featureScriptsBack()}
            </Button>
            <FeatureScriptHero feature={feature} />
            <Group gap="sm" wrap="nowrap">
                <FeatureScriptIcon
                    iconUrl={feature.iconUrl}
                    size={IconSize.SECTION}
                />
                <Title order={3}>{feature.name}</Title>
                <FeatureScriptBadges feature={feature} />
            </Group>
            <Text style={{ whiteSpace: "pre-line" }}>
                {feature.description}
            </Text>
            <Group gap="sm">
                <Tooltip label={cannotAddReason} disabled={!cannotAddReason}>
                    {/* data-disabled, not disabled: a disabled button fires no hover for the tip. */}
                    <Button
                        leftSection={<PlusIcon />}
                        data-disabled={cannotAddReason !== undefined}
                        loading={add.isPending}
                        onClick={() => {
                            if (!cannotAddReason) add.mutate();
                        }}
                    >
                        {m.featureScriptsAdd()}
                    </Button>
                </Tooltip>
                {exampleUrl && (
                    <Button
                        variant="default"
                        leftSection={<ArrowSquareOutIcon />}
                        onClick={() => openUrlInNewTab(exampleUrl)}
                    >
                        {m.featureScriptsOpenExample()}
                    </Button>
                )}
            </Group>
        </Stack>
    );
}
