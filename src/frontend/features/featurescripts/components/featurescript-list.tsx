import { Stack, TextInput } from "@mantine/core";
import {
    FolderSimpleIcon,
    MagnifyingGlassIcon,
    PuzzlePieceIcon
} from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import {
    type FeatureScriptOut,
    isHidden
} from "@backend/features/featurescripts/contract";
import { AppSection, AppSections } from "../../../components/app-section";
import {
    PageError,
    PageLoading,
    PageNotice
} from "../../../components/app-notice";
import { ItemTable } from "../../../components/item-row";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { FavoriteIcon } from "../../favorites/components/favorite-button";
import { groupByCategory } from "../categories";
import {
    useFeatureScriptFavoritesQuery,
    useFeatureScriptsQuery,
    useIsOwner
} from "../queries";
import { FeatureScriptCard } from "./featurescript-card";

const FAVORITES_SECTION = "favorites";
/** Prefixed, so a folder named "favorites" can't share the favorites' value. */
const CATEGORY_SECTION = "category:";
const OTHER_SECTION = "other";

/** A few dozen features: filtering them needs no index. */
function matches(feature: FeatureScriptOut, query: string): boolean {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const text = `${feature.name} ${feature.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
}

interface Section {
    value: string;
    name: string;
    icon: ReactNode;
    features: FeatureScriptOut[];
}

interface FeatureScriptRowsProps {
    features: FeatureScriptOut[];
}

function FeatureScriptRows(props: FeatureScriptRowsProps): ReactNode {
    return (
        <ItemTable>
            {props.features.map((feature) => (
                <FeatureScriptCard key={feature.id} feature={feature} />
            ))}
        </ItemTable>
    );
}

/** Favorites, then each category, each section opening and closing on its own. */
export function FeatureScriptList(): ReactNode {
    const { data, isPending, isError } = useFeatureScriptsQuery();
    const favorites = useFeatureScriptFavoritesQuery();
    const isOwner = useIsOwner();
    const [query, setQuery] = useState("");
    // The closed ones, so a category a new load adds starts open.
    const [closed, setClosed] = useState<string[]>([]);

    if (isPending) {
        return <PageLoading title={m.featureScriptsLoading()} />;
    }
    if (isError) {
        return <PageError title={m.featureScriptsLoadFailed()} />;
    }

    const shown = data.features.filter(
        (feature) => (isOwner || !isHidden(feature)) && matches(feature, query)
    );
    const favoriteIds = favorites.data?.featureScriptIds ?? [];
    const favorited = favoriteIds
        .map((id) => shown.find((feature) => feature.id === id))
        .filter((feature) => feature !== undefined);

    const sections: Section[] = groupByCategory(shown).map((category) => ({
        value:
            category.name === undefined
                ? OTHER_SECTION
                : CATEGORY_SECTION + category.name,
        name: category.name ?? m.featureScriptsOtherCategory(),
        icon: <FolderSimpleIcon size={IconSize.MEDIUM} />,
        features: category.features
    }));
    // Searching shows each match once, in its category.
    if (!query && favorited.length > 0) {
        sections.unshift({
            value: FAVORITES_SECTION,
            name: m.featureScriptsFavorites(),
            icon: <FavoriteIcon size={IconSize.MEDIUM} />,
            features: favorited
        });
    }

    return (
        <Stack gap={0}>
            <TextInput
                type="search"
                autoFocus
                p="sm"
                leftSection={<MagnifyingGlassIcon />}
                placeholder={m.featureScriptsSearch()}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {sections.length === 0 ? (
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
                <AppSections
                    opened={sections
                        .map((section) => section.value)
                        .filter((value) => !closed.includes(value))}
                    onChange={(opened) =>
                        setClosed(
                            sections
                                .map((section) => section.value)
                                .filter((value) => !opened.includes(value))
                        )
                    }
                >
                    {sections.map((section) => (
                        <AppSection
                            key={section.value}
                            value={section.value}
                            name={section.name}
                            icon={section.icon}
                        >
                            <FeatureScriptRows features={section.features} />
                        </AppSection>
                    ))}
                </AppSections>
            )}
        </Stack>
    );
}
