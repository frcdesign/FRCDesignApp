import {
    Center,
    Checkbox,
    Loader,
    Select,
    Stack,
    TextInput
} from "@mantine/core";
import { useSearch } from "@tanstack/react-router";
import {
    type Dispatch,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Selection,
    type ConfigurationKey,
    ConfigurationResult,
    ConfigurationParameter,
    ParameterType,
    EnumParameter,
    BooleanParameter,
    StringParameter,
    QuantityParameter,
    UnitInfo,
    EMPTY_UNIT_INFO,
    SearchRecord
} from "@backend/features/configurations/contract";
import {
    evaluateCondition,
    findRecordForConfiguration,
    getEvaluateOptions,
    getVisibleOptions
} from "@backend/features/configurations/utils";
import {
    canonicalizeValue,
    toKey,
    toSelection
} from "@backend/features/configurations/selection";
import {
    type EvaluateOptions,
    formatValueWithUnits,
    valueWithUnits,
    evaluateExpression
} from "@backend/features/configurations/input-parser";
import { useConfigurationQuery, useUnitInfoQuery } from "../queries";
import { SectionNotice } from "../../../components/app-zero-state";
import { InputRow } from "../../../components/input-row";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import {
    normalizeSelection,
    resolveSelectedOption,
    sameSelection,
    withParameterValue
} from "../parameter-value";

interface ConfigurationWrapperProps {
    insertableId: string;
    microversionId: string;
    selection?: Selection;
    setSelection: Dispatch<Selection>;
    /**
     * Reported here because only this component has the parameters the key is
     * measured against.
     */
    onConfigurationKey?: (configurationKey: ConfigurationKey) => void;
    /** Reports the record the selection produces, for the menu's header. */
    onRecord?: (record: SearchRecord | undefined) => void;
}

/** Reports the selection's key, and the record it resolves to. */
function useReportSelection(
    parameters: ConfigurationParameter[] | undefined,
    records: SearchRecord[] | undefined,
    selection: Selection | undefined,
    onConfigurationKey?: (configurationKey: ConfigurationKey) => void,
    onRecord?: (record: SearchRecord | undefined) => void
) {
    useEffect(() => {
        if (!parameters || !selection) {
            return;
        }
        const configurationKey = toKey(selection, parameters);
        onConfigurationKey?.(configurationKey);
        if (records) {
            onRecord?.(findRecordForConfiguration(configurationKey, records));
        }
    }, [parameters, records, selection, onConfigurationKey, onRecord]);
}

export function ConfigurationWrapper(
    props: ConfigurationWrapperProps
): ReactNode {
    const {
        insertableId,
        microversionId,
        selection,
        setSelection,
        onConfigurationKey,
        onRecord
    } = props;

    const query = useConfigurationQuery(insertableId, microversionId);

    const search = useSearch({ from: "/app" });
    // Units come from the current document; empty when not connected to one, in
    // which case each quantity renders in its own unit (see getEvaluateOptions).
    const isConnected = useIsConnectedToOnshape();
    const unitInfoQuery = useUnitInfoQuery(search, isConnected);
    const unitInfo = unitInfoQuery.data ?? EMPTY_UNIT_INFO;

    const parameters = query.data?.parameters;
    // Whole the moment the parameters are known, since a search hit names only
    // its overrides, and settled against the conditions so a row never has to
    // write its own value back through an effect.
    const whole = useMemo(
        () =>
            parameters
                ? normalizeSelection(
                      toSelection(selection ?? {}, parameters),
                      parameters
                  )
                : undefined,
        [parameters, selection]
    );

    // The one place the panel writes back: the menu inserts the selection it
    // holds, so settling has to reach it. `sameSelection` is what stops the
    // loop, and it stops after one write only while normalizeSelection reaches
    // a fixed point — see the cap it can bail out at.
    useEffect(() => {
        if (whole && !sameSelection(selection, whole)) {
            setSelection(whole);
        }
    }, [whole, selection, setSelection]);

    useReportSelection(
        parameters,
        query.data?.records,
        whole,
        onConfigurationKey,
        onRecord
    );

    // Before the spinner: a failed fetch leaves `whole` undefined too, so
    // testing that first would spin forever instead of reporting the failure.
    if (query.isError) {
        return <SectionNotice title="Failed to load selection." />;
    }
    // isLoading, not isPending: the units query sits disabled (and so forever
    // pending) when there is no document to ask.
    if (query.isPending || unitInfoQuery.isLoading || !whole) {
        return (
            <Center my="md">
                <Loader />
            </Center>
        );
    }

    return (
        <ConfigurationParameters
            configurationResult={query.data}
            selection={whole}
            setSelection={setSelection}
            unitInfo={unitInfo}
        />
    );
}

interface ConfigurationParametersProps {
    configurationResult: ConfigurationResult;
    selection: Selection;
    setSelection: Dispatch<Selection>;
    unitInfo: UnitInfo;
}

function ConfigurationParameters(
    props: ConfigurationParametersProps
): ReactNode {
    const { configurationResult, selection, setSelection, unitInfo } = props;

    // Spaced by the stack, not by a margin on each row, which the first row
    // would add to the gap the body already leaves above it.
    return (
        <Stack gap="sm">
            {configurationResult.parameters.map((parameter) => (
                <ParameterRow
                    key={parameter.id}
                    parameter={parameter}
                    selection={selection}
                    setSelection={setSelection}
                    parameters={configurationResult.parameters}
                    unitInfo={unitInfo}
                />
            ))}
        </Stack>
    );
}

interface ParameterRowProps {
    parameter: ConfigurationParameter;
    selection: Selection;
    setSelection: Dispatch<Selection>;
    parameters: ConfigurationParameter[];
    unitInfo: UnitInfo;
}

/**
 * One row, given its own component so its handler is a stable value. Built inside
 * the `.map` it replaces, it changed identity every render — and effects name it.
 */
function ParameterRow(props: ParameterRowProps): ReactNode {
    const { parameter, selection, setSelection, parameters, unitInfo } = props;

    const handleValueChange = useCallback(
        (newValue: string | undefined) => {
            // Hands back the same selection when nothing moves, which React
            // treats as no change at all.
            setSelection(withParameterValue(selection, parameter, newValue));
        },
        [parameter, selection, setSelection]
    );

    return (
        <ParameterInput
            parameter={parameter}
            value={selection[parameter.id]}
            selection={selection}
            parameters={parameters}
            onValueChange={handleValueChange}
            unitInfo={unitInfo}
        />
    );
}

interface ParameterProps<T extends ConfigurationParameter> {
    parameter: T;
    /** Absent when the selection omits it, which means the default. */
    value: string | undefined;
    onValueChange: (newValue: string | undefined) => void;
    selection: Selection;
    parameters: ConfigurationParameter[];
    unitInfo: UnitInfo;
}

function ParameterInput(
    props: ParameterProps<ConfigurationParameter>
): ReactNode {
    const { parameter, selection, parameters } = props;

    if (!evaluateCondition(parameter.condition, selection, parameters)) {
        return null;
    }

    // Narrowed on `parameter` rather than `props`, which carries the union.
    switch (parameter.type) {
        case ParameterType.ENUM:
            return <EnumInput {...props} parameter={parameter} />;
        case ParameterType.BOOLEAN:
            return <BooleanInput {...props} parameter={parameter} />;
        case ParameterType.STRING:
            return <StringInput {...props} parameter={parameter} />;
        case ParameterType.QUANTITY:
            return <QuantityInput {...props} parameter={parameter} />;
    }
}

function EnumInput(props: ParameterProps<EnumParameter>): ReactNode {
    const { parameter, value, onValueChange, selection, parameters } = props;

    const visibleOptions = getVisibleOptions(parameter, selection, parameters);
    // Already settled by normalizeSelection; nothing visible means nothing to show.
    const currentOption = resolveSelectedOption(
        visibleOptions,
        value,
        parameter.default
    );
    if (!currentOption) {
        return null;
    }

    return (
        <InputRow label={parameter.name} htmlFor={parameter.id}>
            <Select
                id={parameter.id}
                data={visibleOptions.map((option) => ({
                    value: option.id,
                    label: option.name
                }))}
                value={currentOption.id}
                flex={1}
                allowDeselect={false}
                checkIconPosition="right"
                maxDropdownHeight={250}
                comboboxProps={{ withinPortal: true }}
                onChange={(newValue) => {
                    if (newValue !== null) {
                        onValueChange(newValue);
                    }
                }}
            />
        </InputRow>
    );
}

function BooleanInput(props: ParameterProps<BooleanParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <InputRow label={parameter.name} htmlFor={parameter.id} controlFirst>
            <Checkbox
                id={parameter.id}
                checked={(value ?? parameter.default) === "true"}
                // The checkbox is shorter than an input, so center it against the label
                style={{ alignSelf: "center" }}
                styles={{
                    input: { cursor: "pointer" }
                }}
                onChange={(event) =>
                    onValueChange(
                        event.currentTarget.checked ? "true" : "false"
                    )
                }
            />
        </InputRow>
    );
}

function StringInput(props: ParameterProps<StringParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <InputRow label={parameter.name} htmlFor={parameter.id}>
            <TextInput
                id={parameter.id}
                value={value ?? parameter.default}
                flex={1}
                onChange={(event) => onValueChange(event.currentTarget.value)}
            />
        </InputRow>
    );
}

/** Everything the box shows: the raw expression, its display, and any error. */
interface QuantityBox {
    /** What the user typed, shown while the input has focus. */
    expression: string;
    /** The evaluated value, shown while it does not. */
    display: string;
    errorMessage?: string;
}

/** What the box shows for a value, and the error if it does not evaluate. */
function seedFrom(
    value: string | undefined,
    parameter: QuantityParameter,
    options: EvaluateOptions
): QuantityBox {
    if (value === undefined) {
        const display = formatValueWithUnits(
            valueWithUnits(parameter.defaultValue, parameter.unit),
            options.displayUnit,
            options.displayPrecision
        );
        return { expression: parameter.default, display };
    }
    const result = evaluateExpression(value, options);
    // Reported in the field rather than as a toast: the field is where the
    // value is, and seeding happens during render.
    return result.hasError
        ? {
              expression: result.expression,
              display: result.expression,
              errorMessage: result.errorMessage
          }
        : { expression: value, display: result.displayExpression };
}

function QuantityInput(props: ParameterProps<QuantityParameter>): ReactNode {
    // Alone among the inputs in holding its own state: the box keeps what was
    // typed, and `value` re-seeds it only when it changes somewhere else.
    const { parameter, value, onValueChange, unitInfo } = props;

    const evaluateOptions = useMemo(
        () => getEvaluateOptions(parameter, unitInfo),
        [parameter, unitInfo]
    );

    const inputRef = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);

    const [box, setBox] = useState(() =>
        seedFrom(value, parameter, evaluateOptions)
    );

    // A value this box did not submit came from elsewhere — a favorite, a
    // search hit — so the typed expression it replaces is no longer the value.
    const [emitted, setEmitted] = useState(value);
    if (value !== emitted) {
        setEmitted(value);
        setBox(seedFrom(value, parameter, evaluateOptions));
    }

    const handleSubmit = () => {
        setFocused(false);
        const result = evaluateExpression(box.expression, evaluateOptions);
        if (result.hasError) {
            // Don't change the value so the thumbnail is still okay
            setBox({
                expression: result.expression,
                display: result.expression,
                errorMessage: result.errorMessage
            });
            return;
        }
        setBox({
            expression: result.expression,
            display: result.displayExpression
        });
        // Canonical, so the menu holds a selection like everywhere else;
        // `expression` keeps what was typed for as long as this input lives.
        const canonical = canonicalizeValue(parameter, result.expression);
        setEmitted(canonical);
        onValueChange(canonical);
    };

    return (
        <InputRow label={parameter.name} htmlFor={parameter.id}>
            <TextInput
                id={parameter.id}
                ref={inputRef}
                value={focused ? box.expression : box.display}
                error={box.errorMessage}
                flex={1}
                onFocus={(event) => {
                    setFocused(true);
                    event.currentTarget.select();
                }}
                onBlur={handleSubmit}
                onKeyDown={(event) => {
                    // blur() submits; calling handleSubmit too ran it twice.
                    if (event.key === "Enter") {
                        inputRef.current?.blur();
                    }
                }}
                onChange={(event) =>
                    setBox((current) => ({
                        ...current,
                        expression: event.currentTarget.value
                    }))
                }
            />
        </InputRow>
    );
}
