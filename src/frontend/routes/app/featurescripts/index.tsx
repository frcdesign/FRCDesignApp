import { Stack, TextInput } from "@mantine/core";
import { MagnifyingGlassIcon, PuzzlePieceIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
    type FeatureScriptOut,
    isHidden
} from "@backend/features/featurescripts/contract";
import {
    PageError,
    PageLoading,
    PageNotice
} from "../../../components/app-notice";
import { ItemTable } from "../../../components/item-row";
import { FeatureScriptCard } from "../../../features/featurescripts/components/featurescript-card";
import {
    useFeatureScriptsQuery,
    useIsOwner
} from "../../../features/featurescripts/queries";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";

export const Route = createFileRoute("/app/featurescripts/")({
    component: FeatureScriptsPage
});

/** A few dozen features: filtering them needs no index. */
function matches(feature: FeatureScriptOut, query: string): boolean {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const text = `${feature.name} ${feature.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
}

function FeatureScriptsPage(): ReactNode {
    const { data, isPending, isError } = useFeatureScriptsQuery();
    const isOwner = useIsOwner();
    const [query, setQuery] = useState("");

    if (isPending) {
        return <PageLoading title={m.featureScriptsLoading()} />;
    }
    if (isError) {
        return <PageError title={m.featureScriptsLoadFailed()} />;
    }

    const shown = data.features.filter(
        (feature) => (isOwner || !isHidden(feature)) && matches(feature, query)
    );

    return (
        <Stack gap={0}>
            <TextInput
                type="search"
                autoFocus
                p="sm"
                pb={0}
                leftSection={<MagnifyingGlassIcon />}
                placeholder={m.featureScriptsSearch()}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {shown.length === 0 ? (
                <PageNotice
                    title={
                        query
                            ? m.featureScriptsNoMatches()
                            : m.featureScriptsNone()
                    }
                    icon={<PuzzlePieceIcon size={IconSize.SECTION} />}
                    justifyUp
                />
            ) : (
                <ItemTable>
                    {shown.map((feature) => (
                        <FeatureScriptCard key={feature.id} feature={feature} />
                    ))}
                </ItemTable>
            )}
        </Stack>
    );
}
