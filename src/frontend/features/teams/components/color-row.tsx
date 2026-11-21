import {
    ColorInput,
    ColorSwatch,
    Group,
    Select,
    Stack,
    Text
} from "@mantine/core";
import { type Dispatch, ReactNode, useState } from "react";
import { type Selection } from "@backend/features/configurations/contract";
import { type TeamColor } from "@backend/features/teams/contract";
import { LabeledRow } from "../../../components/parameter-input";
import { m } from "../../../paraglide/messages";
import { type ColorControl, readColor, writeColor } from "../color";

const CUSTOM = "custom";

interface ColorRowProps {
    control: ColorControl;
    selection: Selection;
    setSelection: Dispatch<Selection>;
    /** The current team's, offered first; empty off a team. */
    teamColors: TeamColor[];
}

/** One Color in place of the inputs a part spells its color with. */
export function ColorRow(props: ColorRowProps): ReactNode {
    const { control, selection, setSelection, teamColors } = props;
    const color = readColor(control, selection);
    const [isCustom, setIsCustom] = useState(
        color === undefined || !teamColors.some((each) => each.hex === color)
    );
    const inputId = `color-${control.kind}`;

    const setColor = (hex: string) =>
        setSelection(writeColor(control, selection, hex));

    const customInput = (
        <ColorInput
            id={teamColors.length === 0 ? inputId : undefined}
            format="hex"
            value={color ?? ""}
            placeholder={m.teamColorPlaceholder()}
            onChangeEnd={setColor}
        />
    );
    if (teamColors.length === 0) {
        return (
            <LabeledRow label={m.teamColorLabel()} inputId={inputId}>
                {customInput}
            </LabeledRow>
        );
    }

    return (
        <LabeledRow label={m.teamColorLabel()} inputId={inputId}>
            <Stack gap={4}>
                <Select
                    id={inputId}
                    data={[
                        ...teamColors.map((each) => ({
                            value: each.hex,
                            label: each.name
                        })),
                        { value: CUSTOM, label: m.teamColorCustom() }
                    ]}
                    value={isCustom ? CUSTOM : (color ?? CUSTOM)}
                    allowDeselect={false}
                    checkIconPosition="right"
                    leftSection={
                        !isCustom && color ? (
                            <ColorSwatch color={color} size={14} />
                        ) : undefined
                    }
                    renderOption={({ option }) => (
                        <Group gap="xs" wrap="nowrap">
                            {option.value !== CUSTOM && (
                                <ColorSwatch color={option.value} size={14} />
                            )}
                            <Text size="sm">{option.label}</Text>
                        </Group>
                    )}
                    onChange={(value) => {
                        if (value === null) return;
                        if (value === CUSTOM) {
                            setIsCustom(true);
                            return;
                        }
                        setIsCustom(false);
                        setColor(value);
                    }}
                />
                {isCustom && customInput}
            </Stack>
        </LabeledRow>
    );
}
