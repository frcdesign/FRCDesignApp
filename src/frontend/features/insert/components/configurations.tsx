import {
    Center,
    Checkbox,
    Group,
    Loader,
    Select,
    Stack,
    Text,
    TextInput
} from "@mantine/core";
import { useSearch } from "@tanstack/react-router";
import {
    type Dispatch,
    JSX,
    ReactNode,
    type SyntheticEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Selection,
    ConfigurationResult,
    ConfigurationParameter,
    ParameterType,
    EnumParameter,
    BooleanParameter,
    StringParameter,
    QuantityParameter,
    UnitInfo,
    EnumOption,
    EMPTY_UNIT_INFO,
    SearchRecord
} from "@backend/features/configurations/models";
import {
    evaluateCondition,
    findRecordForConfiguration,
    getEvaluateOptions,
    getOption,
    getVisibleOptions
} from "@backend/features/configurations/utils";
import {
    canonicalizeValue,
    toKey,
    toSelection
} from "@backend/features/configurations/selection";
import {
    formatValueWithUnits,
    valueWithUnits,
    evaluateExpression
} from "@backend/features/configurations/input-parser";
import { useConfigurationQuery, useUnitInfoQuery } from "../queries";
import { showErrorToast } from "../../../lib/notifications";
import { SectionError } from "../../../components/app-zero-state";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";

interface ConfigurationWrapperProps {
    insertableId: string;
    microversionId: string;
    selection?: Selection;
    setSelection: Dispatch<Selection>;
    /**
     * Reported here because only this component has the parameters the key is
     * measured against.
     */
    onConfigurationKey?: (configurationKey: string) => void;
    /** Reports the record the selection produces, for the menu's header. */
    onRecord?: (record: SearchRecord | undefined) => void;
}

/** Event handler that exposes the target element's value as a boolean. */
function handleBooleanChange(handler: Dispatch<boolean>) {
    return (event: SyntheticEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).checked);
}

/** Reports the selection's key, and the record it resolves to. */
function useReportSelection(
    parameters: ConfigurationParameter[] | undefined,
    records: SearchRecord[] | undefined,
    selection: Selection | undefined,
    onConfigurationKey?: (configurationKey: string) => void,
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

export function ConfigurationWrapper(props: ConfigurationWrapperProps) {
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
    // Whole the moment the parameters are known, whatever the menu opened with
    // — a search hit names only the values that hit overrides. Derived rather
    // than stored, so there is no render where this holds a partial one.
    const whole = useMemo(
        () =>
            parameters ? toSelection(selection ?? {}, parameters) : undefined,
        [parameters, selection]
    );
    useReportSelection(
        parameters,
        query.data?.records,
        whole,
        onConfigurationKey,
        onRecord
    );

    // isLoading, not isPending: the units query sits disabled (and so forever
    // pending) when there is no document to ask.
    if (query.isPending || unitInfoQuery.isLoading || !whole) {
        return (
            <Center my="md">
                <Loader />
            </Center>
        );
    } else if (query.isError) {
        return <SectionError title="Failed to load selection." />;
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

interface ConfigurationParameterProps {
    configurationResult: ConfigurationResult;
    selection: Selection;
    setSelection: Dispatch<Selection>;
    unitInfo: UnitInfo;
}

function ConfigurationParameters(props: ConfigurationParameterProps) {
    const { configurationResult, selection, setSelection, unitInfo } = props;

    const parameters = configurationResult.parameters.map((parameter) => {
        const handleValueChange = (newValue: string | undefined) => {
            if (newValue === undefined) {
                if (!(parameter.id in selection)) return;
                const next = { ...selection };
                delete next[parameter.id];
                setSelection(next);
            } else {
                if (selection[parameter.id] === newValue) return;
                setSelection({
                    ...selection,
                    [parameter.id]: newValue
                });
            }
        };

        return (
            <ParameterInput
                key={parameter.id}
                parameter={parameter}
                value={selection[parameter.id]}
                selection={selection}
                parameters={configurationResult.parameters}
                onValueChange={handleValueChange}
                unitInfo={unitInfo}
            />
        );
    });
    // Spaced by the stack, not by a margin on each row, which the first row
    // would add to the gap the body already leaves above it.
    return <Stack gap="sm">{parameters}</Stack>;
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
    const { parameter } = props;

    useEffect(() => {
        if (
            !evaluateCondition(
                parameter.condition,
                props.selection,
                props.parameters
            )
        ) {
            props.onValueChange(undefined);
        }
    }, [parameter.condition, props]);

    if (
        !evaluateCondition(
            parameter.condition,
            props.selection,
            props.parameters
        )
    ) {
        return null;
    }

    // Need to expose and use parameter directly to get type narrowing
    if (parameter.type === ParameterType.ENUM) {
        return <EnumInput {...props} parameter={parameter} />;
    } else if (parameter.type === ParameterType.BOOLEAN) {
        return <BooleanInput {...props} parameter={parameter} />;
    } else if (parameter.type === ParameterType.STRING) {
        return <StringInput {...props} parameter={parameter} />;
    } else if (parameter.type === ParameterType.QUANTITY) {
        return <QuantityInput {...props} parameter={parameter} />;
    }
}

/**
 * The height of a default sized Mantine input.
 */
const INPUT_HEIGHT = "36px";

interface InputLabelProps {
    label: string;
    /**
     * The id of the input the label describes.
     */
    htmlFor: string;
    /** True to lead with the input instead of the label. */
    inputFirst?: boolean;
    children: ReactNode;
}

/**
 * Given an input's height so it stays aligned rather than drifting when the
 * input grows to show an error message.
 */
function InputLabel(props: InputLabelProps) {
    const { label, htmlFor, inputFirst = false, children } = props;
    const text = (
        <Text
            size="sm"
            display="flex"
            h={INPUT_HEIGHT}
            style={{ alignItems: "center", cursor: "pointer" }}
            component="label"
            htmlFor={htmlFor}
        >
            {label}
        </Text>
    );

    let result: JSX.Element;
    if (inputFirst) {
        result = (
            <>
                {children}
                {text}
            </>
        );
    } else {
        result = (
            <>
                {text}
                {children}
            </>
        );
    }

    return (
        <Group gap="sm" align="flex-start">
            {result}
        </Group>
    );
}

function getFirstVisibleOption(
    visibleOptions: EnumOption[],
    currentOptionId: string | undefined,
    defaultOptionId: string
): EnumOption | undefined {
    if (visibleOptions.length === 0) {
        return undefined;
    }
    const currentOption = currentOptionId
        ? getOption(visibleOptions, currentOptionId)
        : undefined;
    if (currentOption) {
        return currentOption;
    }
    const defaultOption = getOption(visibleOptions, defaultOptionId);
    if (defaultOption) {
        return defaultOption;
    }
    return visibleOptions[0];
}

function EnumInput(props: ParameterProps<EnumParameter>): ReactNode {
    const { parameter, value, onValueChange, selection, parameters } = props;

    const visibleOptions = getVisibleOptions(parameter, selection, parameters);

    useEffect(() => {
        const option = getFirstVisibleOption(
            visibleOptions,
            value,
            parameter.default
        );
        if (!option) {
            onValueChange(undefined);
        } else if (option.id !== value) {
            onValueChange(option.id);
        }
    }, [onValueChange, parameter.default, value, visibleOptions]);

    const currentOption = getFirstVisibleOption(
        visibleOptions,
        value,
        parameter.default
    );
    if (!currentOption) {
        return null;
    }

    return (
        <InputLabel label={parameter.name} htmlFor={parameter.id}>
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
        </InputLabel>
    );
}

function BooleanInput(props: ParameterProps<BooleanParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <InputLabel label={parameter.name} htmlFor={parameter.id} inputFirst>
            <Checkbox
                id={parameter.id}
                checked={(value ?? parameter.default) === "true"}
                // The checkbox is shorter than an input, so center it against the label
                style={{ alignSelf: "center" }}
                styles={{
                    input: { cursor: "pointer" }
                }}
                onChange={handleBooleanChange((checked) =>
                    onValueChange(checked ? "true" : "false")
                )}
            />
        </InputLabel>
    );
}

function StringInput(props: ParameterProps<StringParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <InputLabel label={parameter.name} htmlFor={parameter.id}>
            <TextInput
                id={parameter.id}
                value={value ?? parameter.default}
                flex={1}
                onChange={(event) => onValueChange(event.currentTarget.value)}
            />
        </InputLabel>
    );
}

function QuantityInput(props: ParameterProps<QuantityParameter>): ReactNode {
    // This parameter doesn't actually use value since it manages it's state internally
    const { parameter, value, onValueChange, unitInfo } = props;

    const evaluateOptions = getEvaluateOptions(parameter, unitInfo);

    const ref = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);

    // The user's raw expression.
    const [expression, setExpression] = useState(value ?? parameter.default);

    // The pretty print value to display. Only shown when the input isn't focused.
    const [display, setDisplay] = useState(() => {
        if (value !== undefined) {
            const expression = evaluateExpression(value, evaluateOptions);
            if (expression.hasError) {
                showErrorToast(
                    "Failed to parse default value for " + parameter.name
                );
                return expression.expression;
            }
            return expression.displayExpression;
        }

        return formatValueWithUnits(
            valueWithUnits(parameter.defaultValue, parameter.unit),
            evaluateOptions.displayUnit,
            evaluateOptions.displayPrecision
        );
    });

    const [errorMessage, setErrorMessage] = useState<string | undefined>(
        undefined
    );

    const handleSubmit = useCallback(() => {
        setFocused(false);
        const result = evaluateExpression(expression, evaluateOptions);
        setExpression(result.expression);
        if (result.hasError) {
            setErrorMessage(result.errorMessage);
            // Don't change the value so the thumbnail is still okay
            setDisplay(result.expression);
        } else {
            setErrorMessage(undefined);
            // Canonical, so the menu holds a selection like everywhere else;
            // `expression` keeps what was typed for as long as this input lives.
            onValueChange(canonicalizeValue(parameter, result.expression));
            setDisplay(result.displayExpression);
        }
    }, [evaluateOptions, expression, onValueChange, parameter]);

    return (
        <InputLabel label={parameter.name} htmlFor={parameter.id}>
            <TextInput
                id={parameter.id}
                ref={ref}
                value={focused ? expression : display}
                error={errorMessage}
                flex={1}
                onFocus={(event) => {
                    setFocused(true);
                    event.currentTarget.select();
                }}
                onBlur={handleSubmit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        ref.current?.blur();
                        handleSubmit();
                    }
                }}
                onChange={(event) => {
                    setExpression(event.currentTarget.value);
                }}
            />
        </InputLabel>
    );
}
