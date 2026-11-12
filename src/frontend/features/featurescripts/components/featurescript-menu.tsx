import { Button, Card, Center, Group, Image, Stack, Text } from "@mantine/core";
import { ArrowSquareOutIcon, PuzzlePieceIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize, RENDER_BACKGROUND } from "../../../lib/style-constants";
import { openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";
import { RequireSignIn } from "../../auth/components/require-access";
import { useFrontendTabUrl } from "../queries";
import { FeatureScriptAddButton } from "./featurescript-add-button";
import { FeatureScriptStatus } from "./featurescript-status";
import { FeatureScriptFavoriteButton } from "./featurescript-favorite-button";

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

interface FeatureScriptMenuProps {
    feature: FeatureScriptOut;
}

/** The popup a row opens, as a part's opens the insert menu. */
export function FeatureScriptMenu(props: FeatureScriptMenuProps): ReactNode {
    const { feature } = props;
    const modal = useAppModal();
    const exampleUrl = useFrontendTabUrl(feature.exampleElementId);

    return (
        <>
            <AppModalBody>
                <FeatureScriptHero feature={feature} />
                <Text style={{ whiteSpace: "pre-line" }}>
                    {feature.description}
                </Text>
            </AppModalBody>
            <AppModalFooter>
                <Group gap="sm">
                    <RequireSignIn>
                        <FeatureScriptFavoriteButton feature={feature} large />
                    </RequireSignIn>
                    <FeatureScriptStatus feature={feature} />
                </Group>
                <Group gap="sm" ml="auto">
                    {exampleUrl && (
                        <Button
                            variant="default"
                            leftSection={<ArrowSquareOutIcon />}
                            onClick={() => openUrlInNewTab(exampleUrl)}
                        >
                            {m.featureScriptsOpenExample()}
                        </Button>
                    )}
                    {/* Closed once sent, so the feature's dialog in Onshape is what shows. */}
                    <FeatureScriptAddButton
                        feature={feature}
                        primary
                        onAdd={modal.close}
                    />
                </Group>
            </AppModalFooter>
        </>
    );
}
