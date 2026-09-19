import { SegmentedControl, Stack, Text } from "@mantine/core";
import { TreeStructureIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { PageNotice } from "../../../components/app-zero-state";
import {
    IconSize,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { ItemTable } from "../../../components/item-row";
import { AddLinkInput } from "./add-link-input";

interface VersionManagerZeroStateProps {
    workspace: WorkspacePath;
}

/**
 * What the page is before anything is linked: nothing to push, nothing to pull,
 * and two empty lists would say neither what this is for nor what to do about
 * it. The field is here rather than in the lists below, because linking one
 * document is the whole of getting started.
 */
export function VersionManagerZeroState(
    props: VersionManagerZeroStateProps
): ReactNode {
    const { workspace } = props;
    // A parent by default, which is the document the welcome text describes:
    // one this document already uses.
    const [direction, setDirection] = useState<LinkDirection>(
        LinkDirection.PARENT
    );

    return (
        <PageNotice
            justifyUp
            icon={
                <AppIcon
                    icon={TreeStructureIcon}
                    size={IconSize.PAGE}
                    color={PrimaryColor.FILLED}
                />
            }
            title="Welcome to Version Manager!"
            description="Version manager lets you automatically push and pull versions between Onshape documents. To get started, paste the link to another Onshape document you use."
            action={
                <Stack gap="xs" w="100%">
                    <SegmentedControl
                        size="xs"
                        fullWidth
                        value={direction}
                        onChange={setDirection}
                        data={[
                            { value: LinkDirection.PARENT, label: "A parent" },
                            { value: LinkDirection.CHILD, label: "A child" }
                        ]}
                    />
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {direction === LinkDirection.PARENT
                            ? "A parent is a document this one uses. You pull its latest versions in."
                            : "A child is a document that uses this one. You push versions of this document out to it."}
                    </Text>
                    {/* The field is a table row, so it needs the table it is
                        a row of even where it stands alone. */}
                    <ItemTable>
                        <AddLinkInput
                            workspace={workspace}
                            direction={direction}
                        />
                    </ItemTable>
                </Stack>
            }
        />
    );
}
