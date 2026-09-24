import {
    ActionIcon,
    Center,
    CopyButton,
    Group,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";
import { useAppModal } from "./open-app-modal";
import type { SearchRecord } from "@backend/features/configurations/contract";
import { FontWeight, IconSize, StatusColor } from "../lib/style-constants";
import { meaningfulPartNumber } from "@backend/features/configurations/part-number";
import { PartNumber } from "./part-number";
import styles from "../lib/styles.module.css";

interface AppTitleProps {
    title: string;
    /** Leading icon, at `IconSize.MEDIUM` to match the title's size. */
    icon?: ReactNode;
    /** A quieter second line, laid out as a row so it can hold controls. */
    subtitle?: ReactNode;
    /** Trailing content on the title's own line, e.g. a status badge. */
    rightSection?: ReactNode;
}

/** One weight and size for every icon-and-text heading in the app. */
export function AppTitle(props: AppTitleProps): ReactNode {
    const { title, icon, subtitle, rightSection } = props;
    return (
        <Group gap="sm" miw={0}>
            {/* Centred, not wrapped in a block, where the icon would go back
                to sitting on the text baseline several pixels low. */}
            {icon && <Center className={styles.titleIcon}>{icon}</Center>}
            <Stack gap={0} miw={0}>
                <Group gap="xs" miw={0}>
                    <Text
                        size="md"
                        fw={FontWeight.SEMI_BOLD}
                        truncate
                        title={title}
                        miw={0}
                    >
                        {title}
                    </Text>
                    {rightSection}
                </Group>
                {subtitle && (
                    // Inheriting the title's line height of 1 reads low.
                    <Group
                        gap={4}
                        // So a long part number ellipsizes.
                        miw={0}
                        fz="xs"
                        lh="xs"
                        c={StatusColor.DIMMED}
                    >
                        {subtitle}
                    </Group>
                )}
            </Stack>
        </Group>
    );
}

interface MenuTitleProps {
    name: string;
    /** The configuration in view, which names the part the element resolves to. */
    record?: SearchRecord;
    icon?: ReactNode;
}

export function MenuTitle(props: MenuTitleProps): ReactNode {
    const { name, record, icon } = props;
    const partNumber = meaningfulPartNumber(record?.partNumber, name);
    return (
        <AppTitle
            icon={icon}
            title={name}
            subtitle={
                partNumber && (
                    <PartNumberLine partNumber={partNumber} url={record?.url} />
                )
            }
        />
    );
}

interface UseMenuTitleProps extends Omit<MenuTitleProps, "name"> {
    /** Undefined until known, which leaves the title the opener set. */
    name: string | undefined;
}

/** Updates the modal's header, which belongs to the modal rather than the content. */
export function useMenuTitle(props: UseMenuTitleProps): void {
    const { name, record, icon } = props;
    const { setTitle } = useAppModal();
    useEffect(() => {
        if (name !== undefined) {
            setTitle(<MenuTitle name={name} record={record} icon={icon} />);
        }
    }, [setTitle, name, record, icon]);
}

/** The xs line box the subtitle row is otherwise sized by, floored. */
const COPY_BUTTON_SIZE = 16;

interface CopyPartNumberButtonProps {
    partNumber: string;
}

/** Copies the part number, for a part with no vendor page to send them to. */
function CopyPartNumberButton(props: CopyPartNumberButtonProps): ReactNode {
    const { partNumber } = props;
    return (
        <CopyButton value={partNumber}>
            {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy part number"}>
                    <ActionIcon
                        color={copied ? "teal" : "gray"}
                        // Any taller and the row grows, shifting the title.
                        size={COPY_BUTTON_SIZE}
                        onClick={copy}
                    >
                        {copied ? (
                            <CheckIcon size={IconSize.TINY} />
                        ) : (
                            <CopyIcon size={IconSize.TINY} />
                        )}
                    </ActionIcon>
                </Tooltip>
            )}
        </CopyButton>
    );
}

interface PartNumberLineProps {
    partNumber: string;
    url?: string;
}

function PartNumberLine(props: PartNumberLineProps): ReactNode {
    const { partNumber, url } = props;
    return (
        <>
            <PartNumber partNumber={partNumber} url={url} />
            {/* Nowhere to send them, so offer the number to search with. */}
            {!url && <CopyPartNumberButton partNumber={partNumber} />}
        </>
    );
}
