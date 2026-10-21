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
    Program
} from "@backend/features/quick-fastener/catalog";
import { FastenerMode } from "@backend/features/quick-fastener/contract";
import { InputRow } from "../../../components/input-row";
import { StatusColor } from "../../../lib/style-constants";
import { isCountersunk } from "../options";
import { useQuickFastenerStore } from "../store";

const INCH = 0.0254;

/** The nut select's value for no nut. */
const NO_NUT = "none";

/** Which fastener goes in each hole: its program, vendor and head, how long, and what goes with it. */
export function FastenerOptionsForm(): ReactNode {
    const options = useQuickFastenerStore((state) => state.options);
    const setOptions = useQuickFastenerStore((state) => state.setOptions);

    const isPreset = options.mode === FastenerMode.PRESET;
    const sizes = getScrewSizes(options.vendor);
    const lengths =
        options.size === undefined
            ? []
            : getLengths(options.vendor, options.size, options.head);
    const nutTypes = getNutTypes(isPreset ? options.size : undefined);

    return (
        <Stack gap="sm">
            <SegmentedControl
                fullWidth
                data={[
                    { value: Program.FRC, label: "FRC" },
                    { value: Program.FTC, label: "FTC" }
                ]}
                value={options.program}
                onChange={(value) => setOptions({ program: value })}
            />
            {options.program === Program.FTC ? (
                <Text size="sm" c={StatusColor.DIMMED}>
                    FTC fasteners aren&apos;t available yet.
                </Text>
            ) : (
                <>
                    <SegmentedControl
                        fullWidth
                        data={[
                            {
                                value: FastenerMode.AUTOMATIC,
                                label: "Automatic"
                            },
                            { value: FastenerMode.PRESET, label: "Preset" }
                        ]}
                        value={options.mode}
                        onChange={(value) => setOptions({ mode: value })}
                    />
                    <InputRow label="Vendor">
                        <Select
                            data={getScrewVendors().map((vendor) => ({
                                value: vendor.id,
                                label: vendor.name
                            }))}
                            value={options.vendor}
                            onChange={(value) =>
                                value && setOptions({ vendor: value })
                            }
                            allowDeselect={false}
                        />
                    </InputRow>
                    {isPreset && (
                        <InputRow label="Size">
                            <Select
                                data={sizes.map((size) => ({
                                    value: size.id,
                                    label: size.name
                                }))}
                                value={options.size ?? null}
                                onChange={(value) =>
                                    value && setOptions({ size: value })
                                }
                                allowDeselect={false}
                            />
                        </InputRow>
                    )}
                    <InputRow label="Head">
                        <Select
                            data={getScrewHeads(
                                options.vendor,
                                isPreset ? options.size : undefined
                            ).map((head) => ({
                                value: head.id,
                                label: head.name
                            }))}
                            value={options.head}
                            onChange={(value) =>
                                value && setOptions({ head: value })
                            }
                            allowDeselect={false}
                        />
                    </InputRow>
                    {isPreset ? (
                        <InputRow label="Length">
                            <Select
                                data={lengths.map((length) => ({
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
                        <InputRow label="Maximum length">
                            <NumberInput
                                value={options.maxLength / INCH}
                                onChange={(value) =>
                                    typeof value === "number" &&
                                    value > 0 &&
                                    setOptions({ maxLength: value * INCH })
                                }
                                min={0.25}
                                max={10}
                                step={0.25}
                                decimalScale={3}
                                suffix=" in."
                            />
                        </InputRow>
                    )}
                    <Checkbox
                        label="Washer under head"
                        checked={options.headWasher}
                        disabled={isCountersunk(options.head)}
                        onChange={(event) =>
                            setOptions({
                                headWasher: event.currentTarget.checked
                            })
                        }
                    />
                    <InputRow label="Nut">
                        <Select
                            data={[
                                { value: NO_NUT, label: "None" },
                                ...nutTypes.map((type) => ({
                                    value: type.id,
                                    label: type.name
                                }))
                            ]}
                            value={options.nutType ?? NO_NUT}
                            onChange={(value) =>
                                value &&
                                setOptions({
                                    nutType:
                                        value === NO_NUT ? undefined : value
                                })
                            }
                            allowDeselect={false}
                        />
                    </InputRow>
                    {options.nutType !== undefined && (
                        <Checkbox
                            label="Washer under nut"
                            checked={options.nutWasher}
                            onChange={(event) =>
                                setOptions({
                                    nutWasher: event.currentTarget.checked
                                })
                            }
                        />
                    )}
                    {!isPreset && (
                        <Checkbox
                            label="Up to next"
                            description="Stop at a gap between parts, rather than reaching across it."
                            checked={options.upToNext}
                            onChange={(event) =>
                                setOptions({
                                    upToNext: event.currentTarget.checked
                                })
                            }
                        />
                    )}
                </>
            )}
        </Stack>
    );
}
