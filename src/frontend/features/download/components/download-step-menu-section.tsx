import { ReactNode } from "react";
import { Menu } from "@mantine/core";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { type InsertableOut } from "@backend/features/library/contract";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { MenuSection } from "../../../components/app-menu";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { useAccessData } from "../../auth/access-level";
import { startSignIn } from "../../auth/sign-in";
import { type DownloadArgs, useStepExportMutation } from "../queries";
import { m } from "../../../paraglide/messages";

interface DownloadStepMenuSectionProps extends DownloadArgs {
    insertable: InsertableOut;
    selection?: PartialSelection;
}

/** Inside Onshape only, where the insert menu's footer inserts instead. */
export function DownloadStepMenuSection(
    props: DownloadStepMenuSectionProps
): ReactNode {
    const { insertable, selection, isFavorite, source } = props;
    const isConnected = useIsConnectedToOnshape();
    const { signedIn, isPending } = useAccessData();
    const exportMutation = useStepExportMutation(insertable, selection, {
        isFavorite,
        source
    });

    if (!isConnected || isPending) {
        return null;
    }

    return (
        <MenuSection label={m.downloadStepMenuSection()}>
            {signedIn ? (
                <Menu.Item
                    leftSection={<DownloadSimpleIcon />}
                    onClick={() => exportMutation.mutate()}
                >
                    {m.downloadStepButton()}
                </Menu.Item>
            ) : (
                <Menu.Item
                    leftSection={<DownloadSimpleIcon />}
                    onClick={startSignIn}
                >
                    {m.downloadStepSignIn()}
                </Menu.Item>
            )}
        </MenuSection>
    );
}
