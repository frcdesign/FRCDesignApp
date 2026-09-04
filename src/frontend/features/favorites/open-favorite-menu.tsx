import { openAppModal } from "../../components/open-app-modal";
import { type Selection } from "@backend/features/configurations/models";
import { FavoriteMenuContent } from "./components/favorite-menu";
import { MenuTitle } from "../../components/app-title";
import { FavoriteIcon } from "./components/favorite-button";
import { IconSize } from "../../lib/style-constants";

interface OpenFavoriteMenuProps {
    favoriteId: string;
    insertableName: string;
    /** What the favorite opens with today. */
    configuration?: Selection;
}

export function openFavoriteMenu(props: OpenFavoriteMenuProps) {
    const { favoriteId, insertableName, configuration } = props;
    // Minted here so the content can update the header as the selection changes.
    const modalId = crypto.randomUUID();
    openAppModal({
        modalId,
        title: (
            <MenuTitle
                name={insertableName}
                icon={<FavoriteIcon size={IconSize.MEDIUM} />}
            />
        ),
        size: 500,
        children: (
            <FavoriteMenuContent
                favoriteId={favoriteId}
                modalId={modalId}
                initialSelection={configuration}
            />
        )
    });
}
