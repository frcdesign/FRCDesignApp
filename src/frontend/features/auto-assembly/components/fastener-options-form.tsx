import { Text } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type ConfigurationParameter,
    ParameterType,
    type Selection
} from "@backend/features/configurations/contract";
import { Program } from "@backend/features/auto-assembly/catalog";
import {
    FastenerMode,
    StopCondition
} from "@backend/features/auto-assembly/contract";
import {
    FastenerKind,
    GENERIC,
    isCountersunk,
    partVendors,
    StudioInput
} from "@backend/features/auto-assembly/studios";
import { ParameterInput } from "../../../components/parameter-input";
import { StatusColor } from "../../../lib/style-constants";
import { Part, PART_KIND, type SettledChoices } from "../options";
import {
    FORM_PARAMETERS,
    FormInput,
    formParameter,
    SIZING_PARAMETER
} from "../parameters";
import { useAutoAssemblyStore } from "../store";
import { FullWidthRow, ParameterGroup } from "./parameter-group";

interface FormInputRowProps {
    id: FormInput;
    settled: SettledChoices;
}

/** One of Auto Assembly's own parameters. */
export function FormInputRow(props: FormInputRowProps): ReactNode {
    const { id, settled } = props;
    const setForm = useAutoAssemblyStore((state) => state.setForm);
    return (
        <ParameterInput
            parameter={formParameter(id)}
            value={settled.form[id]}
            selection={settled.form}
            parameters={FORM_PARAMETERS}
            onValueChange={(value) => value !== undefined && setForm(id, value)}
        />
    );
}

interface FastenerOptionsFormProps {
    settled: SettledChoices;
}

/**
 * Which fastener goes in each hole, in a `ParameterGrid`: the screw, a group
 * for each washer and the nut, then, sized automatically, where it stops.
 */
export function FastenerOptionsForm(
    props: FastenerOptionsFormProps
): ReactNode {
    const { settled } = props;
    const isFtc = settled.form[FormInput.PROGRAM] === Program.FTC;

    return (
        <>
            <ParameterGroup title="Fastener">
                <FormInputRow id={FormInput.PROGRAM} settled={settled} />
                {isFtc ? (
                    <FullWidthRow>
                        <Text size="sm" c={StatusColor.DIMMED}>
                            FTC fasteners aren&apos;t available yet.
                        </Text>
                    </FullWidthRow>
                ) : (
                    <ScrewInputs settled={settled} />
                )}
            </ParameterGroup>
            {!isFtc && (
                <>
                    {!isCountersunk(settled.set, settled.screw.head) && (
                        <PartGroup
                            part={Part.SCREW_WASHER}
                            title="Add screw washer"
                            settled={settled}
                        />
                    )}
                    <PartGroup
                        part={Part.NUT}
                        title="Add nut"
                        settled={settled}
                    />
                    {settled.added[Part.NUT] && (
                        <PartGroup
                            part={Part.NUT_WASHER}
                            title="Add nut washer"
                            settled={settled}
                        />
                    )}
                    {settled.mode === FastenerMode.AUTOMATIC && (
                        <StopInputs settled={settled} />
                    )}
                </>
            )}
        </>
    );
}

interface ScrewInputsProps {
    settled: SettledChoices;
}

/**
 * The screw studio's inputs, with Sizing in place of its Length, which shows
 * only when sized by hand. So does Fully threaded, since an automatic screw is
 * partly threaded, the standard.
 */
function ScrewInputs(props: ScrewInputsProps): ReactNode {
    const { settled } = props;
    const setScrew = useAutoAssemblyStore((state) => state.setScrew);
    const setMode = useAutoAssemblyStore((state) => state.setMode);

    const { parameters } = settled.set.studios[FastenerKind.SCREW];
    const selection: Selection = { ...settled.screw };

    return (
        <>
            {parameters.map((parameter) => {
                const sizing = parameter.id === StudioInput.LENGTH && (
                    <ParameterInput
                        key={SIZING_PARAMETER.id}
                        inputId="screw-sizing"
                        parameter={SIZING_PARAMETER}
                        value={settled.mode}
                        selection={{ [SIZING_PARAMETER.id]: settled.mode }}
                        parameters={[SIZING_PARAMETER]}
                        onValueChange={(value) =>
                            value !== undefined &&
                            setMode(value as FastenerMode)
                        }
                    />
                );
                if (
                    (parameter.id === StudioInput.LENGTH ||
                        parameter.id === StudioInput.FULLY_THREADED) &&
                    settled.mode === FastenerMode.AUTOMATIC
                ) {
                    return sizing;
                }
                return [
                    sizing,
                    <ParameterInput
                        key={parameter.id}
                        inputId={`screw-${parameter.id}`}
                        parameter={parameter}
                        value={selection[parameter.id]}
                        selection={selection}
                        parameters={parameters}
                        onValueChange={(value) =>
                            value !== undefined && setScrew(parameter.id, value)
                        }
                    />
                ];
            })}
        </>
    );
}

interface PartGroupProps {
    part: Part;
    title: string;
    settled: SettledChoices;
}

/**
 * A washer or the nut, ticked to add it: its studio's parameters but its
 * Size, which is the screw's. Its Vendor offers those making it in that size,
 * and is left out under a Generic screw, whose parts are Generic too.
 */
function PartGroup(props: PartGroupProps): ReactNode {
    const { part, title, settled } = props;
    const added = useAutoAssemblyStore((state) => state.added[part]);
    const setAdded = useAutoAssemblyStore((state) => state.setAdded);
    const setPart = useAutoAssemblyStore((state) => state.setPart);

    const choice = settled.parts[part];
    if (!choice) {
        return null;
    }
    const kind = PART_KIND[part];
    const { parameters } = settled.set.studios[kind];
    const selection: Selection = { ...choice };
    const shown = parameters.flatMap((parameter): ConfigurationParameter[] => {
        if (parameter.id === StudioInput.SIZE) {
            return [];
        }
        if (parameter.id !== StudioInput.VENDOR) {
            return [parameter];
        }
        if (
            settled.screw.vendor === GENERIC ||
            parameter.type !== ParameterType.ENUM
        ) {
            return [];
        }
        const vendors = partVendors(settled.set, kind, settled.screw.size);
        return [
            {
                ...parameter,
                options: parameter.options.filter((option) =>
                    vendors.includes(option.id)
                )
            }
        ];
    });

    return (
        <ParameterGroup
            title={title}
            checked={added}
            onCheckedChange={(checked) => setAdded(part, checked)}
        >
            {shown.map((parameter) => (
                <ParameterInput
                    key={parameter.id}
                    inputId={`${part}-${parameter.id}`}
                    parameter={parameter}
                    value={selection[parameter.id]}
                    selection={selection}
                    parameters={parameters}
                    onValueChange={(value) =>
                        value !== undefined &&
                        setPart(part, parameter.id, value)
                    }
                />
            ))}
        </ParameterGroup>
    );
}

interface StopInputsProps {
    settled: SettledChoices;
}

/** Where an automatic screw stops, how long it may be, and how deep into threads it goes. */
function StopInputs(props: StopInputsProps): ReactNode {
    const { settled } = props;
    const isFirstGap = settled.form[FormInput.STOP] === StopCondition.FIRST_GAP;
    const isLimited = settled.form[FormInput.LIMIT_LENGTH] === "true";
    return (
        <>
            <FormInputRow id={FormInput.STOP} settled={settled} />
            {isFirstGap && (
                <FormInputRow id={FormInput.MAX_GAP} settled={settled} />
            )}
            <FormInputRow id={FormInput.LIMIT_LENGTH} settled={settled} />
            {isLimited && (
                <FormInputRow id={FormInput.MAX_LENGTH} settled={settled} />
            )}
            <FormInputRow id={FormInput.MAX_THREAD_DEPTH} settled={settled} />
        </>
    );
}
