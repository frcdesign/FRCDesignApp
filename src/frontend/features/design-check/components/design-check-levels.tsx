import { Button, Group, Loader, Select, Stack, Text } from "@mantine/core";
import { type ReactNode, useId } from "react";
import {
    DESIGN_ISSUE_LEVELS,
    type DesignIssueLevel,
    type DesignIssueLevels,
    DesignIssueType,
    getDefaultLevel,
    getDesignIssueLevel,
    isLevelChanged
} from "@backend/features/design-check/contract";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { IssueIcon } from "../../build-status/components/issues";
import {
    getDesignIssueLevelName,
    getDesignIssueName,
    getLevelSection,
    getLevelSectionName,
    LEVEL_SECTIONS
} from "../issue-text";
import {
    useDesignCheckLevelsQuery,
    useSaveDesignCheckLevelsMutation,
    withLevel
} from "../queries";

/** Fits the longest level beside a check's name in Onshape's panel. */
const LEVEL_SELECT_WIDTH = 124;

const ISSUE_TYPES = Object.values(DesignIssueType);

/** Every check, by the tabs it runs in, each at the caller's level for it. */
export function DesignCheckLevels(): ReactNode {
    const query = useDesignCheckLevelsQuery();
    const save = useSaveDesignCheckLevelsMutation();

    if (!query.data) {
        return <Loader size="sm" mx="auto" />;
    }
    const { levels } = query.data;
    const hasChanges = ISSUE_TYPES.some((type) => isLevelChanged(type, levels));

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                {m.designCheckLevelsIntro()}
            </Text>
            {LEVEL_SECTIONS.map((section) => (
                <Stack key={section} gap="xs">
                    <Text size="sm" fw={600}>
                        {getLevelSectionName(section)}
                    </Text>
                    {ISSUE_TYPES.filter(
                        (type) => getLevelSection(type) === section
                    ).map((type) => (
                        <LevelRow
                            key={type}
                            type={type}
                            levels={levels}
                            onChange={(level) =>
                                save.mutate(withLevel(levels, type, level))
                            }
                        />
                    ))}
                </Stack>
            ))}
            {hasChanges && (
                <Button variant="default" onClick={() => save.mutate({})}>
                    {m.designCheckLevelsReset()}
                </Button>
            )}
        </Stack>
    );
}

interface LevelRowProps {
    type: DesignIssueType;
    levels: DesignIssueLevels;
    onChange: (level: DesignIssueLevel) => void;
}

function LevelRow(props: LevelRowProps): ReactNode {
    const { type, levels, onChange } = props;
    const id = useId();
    const level = getDesignIssueLevel(type, levels);
    const isChanged = isLevelChanged(type, levels);

    return (
        <Group justify="space-between" wrap="nowrap" gap="sm">
            <Stack gap={0} miw={0}>
                <Text component="label" htmlFor={id} size="sm">
                    {getDesignIssueName(type)}
                </Text>
                {isChanged && (
                    <Text size="xs" c="dimmed">
                        {m.designCheckLevelDefault({
                            level: getDesignIssueLevelName(
                                getDefaultLevel(type)
                            )
                        })}
                    </Text>
                )}
            </Stack>
            <Select
                id={id}
                w={LEVEL_SELECT_WIDTH}
                flex="none"
                data={DESIGN_ISSUE_LEVELS.map((value) => ({
                    value,
                    label: getDesignIssueLevelName(value)
                }))}
                value={level}
                allowDeselect={false}
                checkIconPosition="right"
                leftSection={
                    level !== "off" && (
                        <IssueIcon severity={level} size={IconSize.SMALL} />
                    )
                }
                onChange={(selected) => {
                    if (selected !== null) {
                        onChange(selected);
                    }
                }}
            />
        </Group>
    );
}
