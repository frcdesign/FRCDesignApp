import { Menu } from "@mantine/core";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { PartialSelection } from "@backend/features/configurations/contract";
import type { Favorite } from "@backend/features/favorites/contract";
import { MenuSection } from "../../../components/app-menu";
import { FavoriteIcon } from "../../favorites/components/favorite-button";

interface ResetConfigurationItemsProps {
    favorite: Favorite | undefined;
    onReset: (selection: PartialSelection) => void;
}

export function ResetConfigurationItems(
    props: ResetConfigurationItemsProps
): ReactNode {
    const { favorite, onReset } = props;
    const favoriteSelection = favorite?.defaultSelection;
    return (
        <MenuSection label="Configuration">
            <Menu.Item
                leftSection={<ArrowCounterClockwiseIcon />}
                onClick={() => onReset({})}
            >
                Reset to defaults
            </Menu.Item>
            {/* A favorite with no selection opens on the defaults. */}
            {favoriteSelection && (
                <Menu.Item
                    leftSection={<FavoriteIcon />}
                    onClick={() => onReset(favoriteSelection)}
                >
                    Reset to favorite configuration
                </Menu.Item>
            )}
        </MenuSection>
    );
}
