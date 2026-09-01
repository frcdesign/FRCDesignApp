import { openAppModal } from "../../components/open-app-modal";
import { FavoriteMenuContent } from "./components/favorite-menu";
import { MenuTitle } from "../../components/app-title";
import { FavoriteIcon } from "./components/favorite-button";
import { IconSize } from "../../lib/style-constants";

interface OpenFavoriteMenuProps {
    favoriteId: string;
    insertableName: string;
    /** What the favorite opens with today, canonical as it is stored. */
    canonicalConfiguration?: string;
}

export function openFavoriteMenu(props: OpenFavoriteMenuProps) {
    const { favoriteId, insertableName, canonicalConfiguration } = props;
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
                canonicalConfiguration={canonicalConfiguration}
            />
        )
    });
}
