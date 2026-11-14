import { useReloadMutation } from "../queries";
import { Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowsClockwiseIcon, WarningIcon } from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { getLibraryName, useLibraryId } from "../../../lib/library";
import { m } from "../../../paraglide/messages";
import { ReactNode } from "react";

interface ReloadButtonProps {
    /** Every document, not just the outdated ones. @default false */
    all?: boolean;
}

export function ReloadButton(props: ReloadButtonProps): ReactNode {
    const { all = false } = props;
    const libraryId = useLibraryId();
    const mutation = useReloadMutation(all);
    // Reloading everything spends the account's Onshape allocation.
    const color = all ? StatusColor.ERROR : StatusColor.INFO;

    const handleClick = () => {
        // Named, since the admin settings can point at a library other than the one shown.
        const library = getLibraryName(libraryId);
        modals.openConfirmModal({
            title: (
                <AppTitle
                    icon={
                        <AppIcon
                            icon={all ? WarningIcon : ArrowsClockwiseIcon}
                            size={IconSize.MEDIUM}
                            color={color}
                        />
                    }
                    title={
                        all
                            ? m.libraryReloadAllTitle()
                            : m.libraryReloadOutdatedTitle()
                    }
                />
            ),
            children: (
                <Text>
                    {all
                        ? m.libraryReloadAllConfirm({ library })
                        : m.libraryReloadOutdatedConfirm({ library })}
                </Text>
            ),
            labels: {
                confirm: m.libraryReloadConfirm(),
                cancel: m.libraryReloadCancel()
            },
            confirmProps: { color },
            onConfirm: () => mutation.mutate()
        });
    };

    return (
        <Button
            color={color}
            leftSection={<ArrowsClockwiseIcon />}
            onClick={handleClick}
            loading={mutation.isPending}
        >
            {m.libraryReload()}
        </Button>
    );
}
