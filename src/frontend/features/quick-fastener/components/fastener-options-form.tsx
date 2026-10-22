import { Text } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type ConfigurationParameter,
    ParameterType,
    type Selection
} from "@backend/features/configurations/contract";
import { Program } from "@backend/features/quick-fastener/catalog";
import {
    FastenerMode,
    StopCondition
} from "@backend/features/quick-fastener/contract";
import {
    FastenerKind,
    GENERIC,
    isCountersunk,
    partVendors,
    STUDIO_PARAMETERS,
    StudioInput
} from "@backend/features/quick-fastener/studios";
import { ParameterInput } from "../../../components/parameter-input";
import { StatusColor } from "../../../lib/style-constants";
import { Part, PART_KIND, type SettledChoices } from "../options";
import {
    AUTOMATIC_LENGTH,
    FORM_PARAMETERS,
    FormInput,
    formParameter,
    lengthParameter,
    lengthValue
} from "../parameters";
import { useQuickFastenerStore } from "../store";
import { FullWidthRow, ParameterGroup } from "./parameter-group";

interface FormInputRowProps {
    id: FormInput;
    settled: SettledChoices;
}

/** One of Quick fastener's own parameters. */
export function FormInputRow(props: FormInputRowProps): ReactNode {
    const { id, settled } = props;
    const setForm = useQuickFastenerStore((state) => state.setForm);
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
 * Which fastener goes in each hole, in a `ParameterGrid`: the screw and
 * whether alike holes are replicated, a group for each washer and the nut,
 * then, sized automatically, where it stops.
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
                    <>
                        <ScrewInputs settled={settled} />
                        <FormInputRow
                            id={FormInput.REPLICATE}
                            settled={settled}
                        />
                    </>
                )}
            </ParameterGroup>
            {!isFtc && (
                <>
                    {!isCountersunk(settled.screw.head) && (
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
 * The screw studio's inputs, its Length with Automatic first. Variant shows
 * only beside a preset length, since an automatic screw is the standard one.
 */
function ScrewInputs(props: ScrewInputsProps): ReactNode {
    const { settled } = props;
    const setScrew = useQuickFastenerStore((state) => state.setScrew);
    const setMode = useQuickFastenerStore((state) => state.setMode);

    const parameters = STUDIO_PARAMETERS[FastenerKind.SCREW];
    const selection: Selection = { ...settled.screw };

    const setLength = (value: string | undefined) => {
        if (value === undefined || value === AUTOMATIC_LENGTH) {
            setMode(FastenerMode.AUTOMATIC);
            return;
        }
        setMode(FastenerMode.PRESET);
        setScrew(StudioInput.LENGTH, value);
    };

    return (
        <>
            {parameters.map((parameter) => {
                if (parameter.id === StudioInput.LENGTH) {
                    return (
                        <ParameterInput
                            key={parameter.id}
                            inputId="screw-length"
                            parameter={lengthParameter()}
                            value={lengthValue(settled.mode, settled.screw)}
                            selection={selection}
                            parameters={parameters}
                            onValueChange={setLength}
                        />
                    );
                }
                if (
                    parameter.id === StudioInput.VARIANT &&
                    settled.mode === FastenerMode.AUTOMATIC
                ) {
                    return null;
                }
                return (
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
                );
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
    const added = useQuickFastenerStore((state) => state.added[part]);
    const setAdded = useQuickFastenerStore((state) => state.setAdded);
    const setPart = useQuickFastenerStore((state) => state.setPart);

    const choice = settled.parts[part];
    if (!choice) {
        return null;
    }
    const kind = PART_KIND[part];
    const parameters = STUDIO_PARAMETERS[kind];
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
        const vendors = partVendors(kind, settled.screw.size);
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

/** Where an automatic screw stops: its condition and limit, and how deep into threads it goes. */
function StopInputs(props: StopInputsProps): ReactNode {
    const { settled } = props;
    const isMaxLength =
        settled.form[FormInput.STOP] === StopCondition.MAX_LENGTH;
    return (
        <>
            <FormInputRow id={FormInput.STOP} settled={settled} />
            <FormInputRow
                id={isMaxLength ? FormInput.MAX_LENGTH : FormInput.MAX_GAP}
                settled={settled}
            />
            <FormInputRow id={FormInput.MAX_THREAD_DEPTH} settled={settled} />
        </>
    );
}
