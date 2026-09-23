import { modals } from "@mantine/modals";
import {
    AppModalBody,
    AppModalFooter,
    AppModalTop
} from "../../../components/app-modal";
import { useMenuTitle } from "../../../components/app-title";
import { Button } from "@mantine/core";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode, useState } from "react";
import { PreviewImageCard } from "../../thumbnails/components/thumbnail";
import {
    ConfigurationWrapper,
    type SelectionReport
} from "../../insert/components/configurations";
import { FavoriteIcon } from "./favorite-button";
import {
    DEFAULT_CONFIGURATION_KEY,
    type PartialSelection,
    Selection
} from "@backend/features/configurations/contract";
import {
    useFavoritesQuery,
    useSetDefaultConfigurationMutation
} from "../queries";
import { useLibraryQuery } from "../../library/queries";
import { PageNotice } from "../../../components/app-zero-state";

interface FavoriteMenuContentProps {
    favoriteId: string;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    /** What the favorite opens with today. */
    initialSelection?: PartialSelection;
}

export function FavoriteMenuContent(
    props: FavoriteMenuContentProps
): ReactNode {
    const { favoriteId, modalId, initialSelection } = props;

    const libraryQuery = useLibraryQuery();
    const favoritesQuery = useFavoritesQuery();
    const insertables = libraryQuery.data?.insertables;
    const favoritesData = favoritesQuery.data;

    const [selection, setSelection] = useState<
        PartialSelection | Selection | undefined
    >(initialSelection);
    // Undefined until the panel settles the selection, which gates saving:
    // saving before then would store nothing, wiping the favorite's selection.
    const [report, setReport] = useState<SelectionReport>();

    const favorite = favoritesData?.favorites[favoriteId];
    const insertable =
        favorite && insertables
            ? insertables[favorite.insertableId]
            : undefined;

    useMenuTitle(modalId, {
        name: insertable?.name,
        record: report?.record,
        icon: <FavoriteIcon size={IconSize.MEDIUM} />
    });

    const setDefaultConfigurationMutation =
        useSetDefaultConfigurationMutation(favoriteId);

    if (!insertable) {
        return null;
    }
    if (!insertable.isConfigurable) {
        return (
            <PageNotice
                title="Cannot edit unconfigurable favorite"
                description={null}
            />
        );
    }

    return (
        <>
            <AppModalTop>
                <PreviewImageCard
                    path={insertable.path}
                    insertableId={insertable.id}
                    microversionId={insertable.microversionId}
                    largeThumbnailUrl={insertable.largeThumbnailUrl}
                    configurationKey={
                        report?.configurationKey ?? DEFAULT_CONFIGURATION_KEY
                    }
                />
            </AppModalTop>
            <AppModalBody>
                <ConfigurationWrapper
                    onReport={setReport}
                    selection={selection}
                    setSelection={setSelection}
                    insertableId={insertable.id}
                    microversionId={insertable.microversionId}
                />
            </AppModalBody>
            <AppModalFooter>
                <Button
                    variant="light"
                    ml="auto"
                    leftSection={<FloppyDiskIcon size={IconSize.SMALL} />}
                    disabled={report === undefined}
                    onClick={() => {
                        if (report) {
                            setDefaultConfigurationMutation.mutate(report);
                        }
                        modals.closeAll();
                    }}
                >
                    Save
                </Button>
            </AppModalFooter>
        </>
    );
}
