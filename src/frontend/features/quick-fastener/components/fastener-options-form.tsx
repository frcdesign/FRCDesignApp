import {
    Checkbox,
    NumberInput,
    SegmentedControl,
    Select,
    Stack,
    Text
} from "@mantine/core";
import { type ReactNode } from "react";
import {
    getLengths,
    getNutTypes,
    getScrewHeads,
    getScrewSizes,
    getScrewVendors,
    getWashers,
    Program
} from "@backend/features/quick-fastener/catalog";
import {
    FastenerMode,
    StopCondition
} from "@backend/features/quick-fastener/contract";
import { InputRow } from "../../../components/input-row";
import { StatusColor } from "../../../lib/style-constants";
import { isCountersunk } from "../options";
import { useQuickFastenerStore } from "../store";

const INCH = 0.0254;

/** Enough for a 32nd of an inch, and few enough to hide metres' rounding. */
const DECIMALS = 5;

/** The nut select's value for no nut. */
const NO_NUT = "none";

interface InchInputProps {
    id: string;
    /** Metres. */
    value: number;
    onChange: (metres: number) => void;
    min: number;
    max: number;
    step: number;
}

/** A length typed in inches and kept in metres. */
function InchInput(props: InchInputProps): ReactNode {
    const { id, value, onChange, min, max, step } = props;
    return (
        <NumberInput
            id={id}
            value={Number((value / INCH).toFixed(DECIMALS))}
            onChange={(typed) =>
                typeof typed === "number" &&
                typed >= min &&
                onChange(typed * INCH)
            }
            min={min}
            max={max}
            step={step}
            decimalScale={DECIMALS}
            suffix=" in."
        />
    );
}

/** Which fastener goes in each hole: its program, vendor, size and head, how long, and what goes with it. */
export function FastenerOptionsForm(): ReactNode {
    const options = useQuickFastenerStore((state) => state.options);
    const setOptions = useQuickFastenerStore((state) => state.setOptions);

    const isPreset = options.mode === FastenerMode.PRESET;
    const washers = getWashers(options.vendor, options.size);
    const hasWasher = options.startWasher || options.endWasher;

    if (options.program === Program.FTC) {
        return (
            <Stack gap="sm">
                <ProgramControl />
                <Text size="sm" c={StatusColor.DIMMED}>
                    FTC fasteners aren&apos;t available yet.
                </Text>
            </Stack>
        );
    }

    return (
        <Stack gap="sm">
            <ProgramControl />
            <SegmentedControl
                fullWidth
                data={[
                    { value: FastenerMode.AUTOMATIC, label: "Automatic" },
                    { value: FastenerMode.PRESET, label: "Preset length" }
                ]}
                value={options.mode}
                onChange={(value) => setOptions({ mode: value })}
            />
            <InputRow label="Vendor" htmlFor="quick-fastener-vendor">
                <Select
                    id="quick-fastener-vendor"
                    data={getScrewVendors().map((vendor) => ({
                        value: vendor.id,
                        label: vendor.name
                    }))}
                    value={options.vendor}
                    onChange={(value) => value && setOptions({ vendor: value })}
                    allowDeselect={false}
                />
            </InputRow>
            <InputRow label="Size" htmlFor="quick-fastener-size">
                <Select
                    id="quick-fastener-size"
                    data={getScrewSizes(options.vendor).map((size) => ({
                        value: size.id,
                        label: size.name
                    }))}
                    value={options.size}
                    onChange={(value) => value && setOptions({ size: value })}
                    allowDeselect={false}
                />
            </InputRow>
            <InputRow label="Head" htmlFor="quick-fastener-head">
                <Select
                    id="quick-fastener-head"
                    data={getScrewHeads(options.vendor, options.size).map(
                        (head) => ({ value: head.id, label: head.name })
                    )}
                    value={options.head}
                    onChange={(value) => value && setOptions({ head: value })}
                    allowDeselect={false}
                />
            </InputRow>
            {isPreset ? (
                <InputRow label="Length" htmlFor="quick-fastener-length">
                    <Select
                        id="quick-fastener-length"
                        data={getLengths(
                            options.vendor,
                            options.size,
                            options.head
                        ).map((length) => ({
                            value: length.id,
                            label: length.name
                        }))}
                        value={options.length ?? null}
                        onChange={(value) =>
                            value && setOptions({ length: value })
                        }
                        allowDeselect={false}
                    />
                </InputRow>
            ) : (
                <>
                    <InputRow
                        label="Stop condition"
                        htmlFor="quick-fastener-stop"
                    >
                        <Select
                            id="quick-fastener-stop"
                            data={[
                                {
                                    value: StopCondition.MAX_LENGTH,
                                    label: "Max length"
                                },
                                {
                                    value: StopCondition.RESPECT_GAPS,
                                    label: "Respect gaps"
                                }
                            ]}
                            value={options.stop}
                            onChange={(value) =>
                                value && setOptions({ stop: value })
                            }
                            allowDeselect={false}
                        />
                    </InputRow>
                    {options.stop === StopCondition.MAX_LENGTH ? (
                        <InputRow
                            label="Max length"
                            htmlFor="quick-fastener-max-length"
                        >
                            <InchInput
                                id="quick-fastener-max-length"
                                value={options.maxLength}
                                onChange={(maxLength) =>
                                    setOptions({ maxLength })
                                }
                                min={0.25}
                                max={10}
                                step={0.25}
                            />
                        </InputRow>
                    ) : (
                        <InputRow
                            label="Max gap to ignore"
                            htmlFor="quick-fastener-max-gap"
                        >
                            <InchInput
                                id="quick-fastener-max-gap"
                                value={options.maxGap}
                                onChange={(maxGap) => setOptions({ maxGap })}
                                min={0}
                                max={1}
                                step={0.03125}
                            />
                        </InputRow>
                    )}
                </>
            )}
            <InputRow label="Nut" htmlFor="quick-fastener-nut">
                <Select
                    id="quick-fastener-nut"
                    data={[
                        { value: NO_NUT, label: "None" },
                        ...getNutTypes(options.size).map((type) => ({
                            value: type.id,
                            label: type.name
                        }))
                    ]}
                    value={options.nutType ?? NO_NUT}
                    onChange={(value) =>
                        value &&
                        setOptions({
                            nutType: value === NO_NUT ? undefined : value
                        })
                    }
                    allowDeselect={false}
                />
            </InputRow>
            <Checkbox
                label="Add start washer"
                checked={options.startWasher}
                disabled={isCountersunk(options.head) || washers.length === 0}
                onChange={(event) =>
                    setOptions({ startWasher: event.currentTarget.checked })
                }
            />
            <Checkbox
                label="Add end washer"
                checked={options.endWasher}
                disabled={options.nutType === undefined || washers.length === 0}
                onChange={(event) =>
                    setOptions({ endWasher: event.currentTarget.checked })
                }
            />
            {hasWasher && washers.length > 1 && (
                <InputRow label="Washer" htmlFor="quick-fastener-washer">
                    <Select
                        id="quick-fastener-washer"
                        data={washers.map((washer) => ({
                            value: washer.type,
                            label: washer.name
                        }))}
                        value={options.washerType ?? null}
                        onChange={(value) =>
                            value && setOptions({ washerType: value })
                        }
                        allowDeselect={false}
                    />
                </InputRow>
            )}
        </Stack>
    );
}

function ProgramControl(): ReactNode {
    const program = useQuickFastenerStore((state) => state.options.program);
    const setOptions = useQuickFastenerStore((state) => state.setOptions);
    return (
        <SegmentedControl
            fullWidth
            data={[
                { value: Program.FRC, label: "FRC" },
                { value: Program.FTC, label: "FTC" }
            ]}
            value={program}
            onChange={(value) => setOptions({ program: value })}
        />
    );
}
