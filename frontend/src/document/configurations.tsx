import {
    Spinner,
    Intent,
    NonIdealState,
    Icon,
    NonIdealStateIconSize,
    FormGroup,
    MenuItem,
    Button,
    Checkbox,
    Alignment,
    InputGroup,
    NumericInput
} from "@blueprintjs/core";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
    Dispatch,
    useEffect,
    ReactNode,
    useRef,
    useState,
    useCallback
} from "react";
import { useCacheOptions, apiGet } from "../api/api";
import {
    Configuration,
    ConfigurationResult,
    ParameterObj,
    evaluateCondition,
    ConfigurationParameterType,
    EnumParameterObj,
    OptionVisibilityConditionType,
    BooleanParameterObj,
    StringParameterObj,
    QuantityParameterObj,
    ContextData,
    QuantityType,
    Unit,
    EnumOption
} from "../api/models";
import { handleBooleanChange } from "../common/utils";
import {
    EvaluateOptions,
    getUnitType,
    formatValueWithUnits,
    valueWithUnits,
    evaluateExpression
} from "./parser";
import { Select } from "@blueprintjs/select";

interface ConfigurationWrapperProps {
    configurationId: string;
    configuration?: Configuration;
    setConfiguration: Dispatch<Configuration>;
}

export function ConfigurationWrapper(props: ConfigurationWrapperProps) {
    const { configurationId, configuration, setConfiguration } = props;

    const cacheOptions = useCacheOptions();
    const query = useQuery<ConfigurationResult>({
        queryKey: ["configuration", configurationId],
        queryFn: async () => {
            return apiGet("/configuration/" + configurationId, {
                cacheOptions
            });
        },
        // Don't refetch query automatically so we don't reset user inputs
        refetchInterval: false
    });

    useEffect(() => {
        // Doing this in a useEffect rather than a .then inside useQuery to prevent some buggy behavior
        // Only fill in the configuration if it isn't already set
        if (!query.data || configuration) {
            return;
        }
        const defaultConfiguration = query.data.parameters.reduce(
            (configuration, parameter) => {
                configuration[parameter.id] = parameter.default;
                return configuration;
            },
            {} as Configuration
        );
        setConfiguration(defaultConfiguration);
    }, [query.data, configuration, setConfiguration]);

    if (query.isPending || !configuration) {
        return <Spinner intent={Intent.PRIMARY} />;
    } else if (query.isError) {
        return (
            <NonIdealState
                icon={
                    <Icon
                        intent="danger"
                        icon="cross"
                        size={NonIdealStateIconSize.STANDARD}
                    />
                }
                title="Failed to load configuration"
                description="If the problem persists, contact the FRCDesignApp developers."
            />
        );
    }

    return (
        <ConfigurationParameters
            configurationResult={query.data}
            configuration={configuration}
            setConfiguration={setConfiguration}
        />
    );
}

interface ConfigurationParameterProps {
    configurationResult: ConfigurationResult;
    configuration: Configuration;
    setConfiguration: Dispatch<Configuration>;
}

function ConfigurationParameters(props: ConfigurationParameterProps) {
    const { configurationResult, configuration, setConfiguration } = props;

    const parameters = configurationResult.parameters.map((parameter) => {
        const handleValueChange = (newValue: string | undefined) => {
            let newConfiguration;
            if (newValue == undefined) {
                newConfiguration = { ...configuration };
                delete newConfiguration[parameter.id];
            } else {
                newConfiguration = {
                    ...configuration,
                    [parameter.id]: newValue
                };
            }
            setConfiguration(newConfiguration);
        };

        return (
            <ConfigurationParameter
                key={parameter.id}
                parameter={parameter}
                value={configuration[parameter.id]}
                configuration={configuration}
                parameters={configurationResult.parameters}
                onValueChange={handleValueChange}
            />
        );
    });
    return <div style={{ width: "100%" }}>{parameters}</div>;
}

interface ParameterProps<T extends ParameterObj> {
    parameter: T;
    value: string;
    onValueChange: (newValue: string | undefined) => void;
    configuration: Configuration;
    parameters: ParameterObj[];
}

function ConfigurationParameter(
    props: ParameterProps<ParameterObj>
): ReactNode {
    const { parameter } = props;

    useEffect(() => {
        if (
            !evaluateCondition(
                parameter.condition,
                props.configuration,
                props.parameters
            )
        ) {
            props.onValueChange(undefined);
        }
    }, [parameter.condition, props]);

    if (
        !evaluateCondition(
            parameter.condition,
            props.configuration,
            props.parameters
        )
    ) {
        return null;
    }

    // Need to expose and use parameter directly to get type narrowing
    if (parameter.type === ConfigurationParameterType.ENUM) {
        return <EnumParameter {...props} parameter={parameter} />;
    } else if (parameter.type === ConfigurationParameterType.BOOLEAN) {
        return <BooleanParameter {...props} parameter={parameter} />;
    } else if (parameter.type === ConfigurationParameterType.STRING) {
        return <StringParameter {...props} parameter={parameter} />;
    } else if (parameter.type === ConfigurationParameterType.QUANTITY) {
        return <QuantityParameter {...props} parameter={parameter} />;
    }
}

function getOption(
    options: EnumOption[],
    optionId: string
): EnumOption | undefined {
    return options.find((option) => option.id == optionId);
}

function getVisibleOptions(
    enumParameter: EnumParameterObj,
    configuration: Configuration,
    parameters: ParameterObj[]
): EnumOption[] {
    // No conditions means everything is shown
    if (enumParameter.optionConditions.length === 0) {
        return enumParameter.options;
    }

    const optionIds = enumParameter.options.map((option) => option.id);

    const validOptionIds = enumParameter.optionConditions
        .filter((optionCondition) =>
            evaluateCondition(
                optionCondition.condition,
                configuration,
                parameters
            )
        )
        .flatMap((optionCondition) => {
            if (optionCondition.type == OptionVisibilityConditionType.LIST) {
                return optionCondition.controlledOptions;
            } else if (
                optionCondition.type == OptionVisibilityConditionType.RANGE
            ) {
                return optionIds.slice(
                    optionIds.indexOf(optionCondition.start),
                    optionIds.indexOf(optionCondition.end) + 1
                );
            }
            throw new Error("Unhandled option condition type");
        });

    const validOptionsSet = new Set(validOptionIds);
    return enumParameter.options.filter((option) =>
        validOptionsSet.has(option.id)
    );
}

function EnumParameter(props: ParameterProps<EnumParameterObj>): ReactNode {
    const { parameter, value, onValueChange, configuration, parameters } =
        props;

    // The active option is the option currently focused by the user
    // const [activeOption, setActiveOption] = useState<EnumOption | null>(null);

    const visibleOptions = getVisibleOptions(
        parameter,
        configuration,
        parameters
    );

    // useMemo to stabilize options across re-renders so, e.g., active item changes work
    // const visibleOptions = useMemo(
    //     () => getVisibleOptions(parameter, configuration, parameters),
    //     [configuration, parameter, parameters]
    // );

    useEffect(() => {
        if (visibleOptions.length === 0) {
            onValueChange(undefined);
            return;
        }
        // Logic to set value to the first visible option or default when a parameter is shown
        if (!getOption(visibleOptions, value)) {
            if (getOption(visibleOptions, parameter.default)) {
                onValueChange(parameter.default);
            } else {
                onValueChange(visibleOptions[0].id);
            }
        }
    }, [onValueChange, parameter.default, value, visibleOptions]);

    if (visibleOptions.length === 0) {
        return null;
    }

    // Same logic as the useEffect
    let currentOption = getOption(visibleOptions, value);
    if (!currentOption) {
        currentOption = getOption(visibleOptions, parameter.default);
        if (!currentOption) {
            currentOption = visibleOptions[0];
        }
    }

    return (
        <FormGroup
            label={parameter.name}
            labelFor={parameter.id}
            inline
            className="full-width"
        >
            <Select<EnumOption>
                items={visibleOptions}
                activeItem={currentOption}
                onItemSelect={(option) => {
                    onValueChange(option.id);
                }}
                itemsEqual="id"
                fill
                popoverProps={{
                    minimal: true,
                    popoverClassName: "enum-menu"
                }}
                filterable={false}
                itemRenderer={(
                    currentOption,
                    { handleClick, handleFocus, modifiers, ref }
                ) => {
                    const selected = value === currentOption.id;
                    return (
                        <MenuItem
                            key={currentOption.id}
                            ref={ref}
                            onClick={handleClick}
                            onFocus={handleFocus}
                            active={modifiers.active}
                            text={currentOption.name}
                            roleStructure="listoption"
                            selected={selected}
                            intent={selected ? Intent.PRIMARY : Intent.NONE}
                        />
                    );
                }}
            >
                <Button
                    id={parameter.id}
                    alignText="start"
                    endIcon="caret-down"
                    text={currentOption.name}
                    fill
                />
            </Select>
        </FormGroup>
    );
}

function BooleanParameter(
    props: ParameterProps<BooleanParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;
    // Add a 100% width div to eat up space to the right of the checkbox
    // Otherwise multiple checkboxes in a row can fold onto the same line
    return (
        <div style={{ width: "100%" }}>
            <Checkbox
                label={parameter.name}
                alignIndicator={Alignment.END}
                inline
                checked={value === "true"}
                onChange={handleBooleanChange((checked) =>
                    onValueChange(checked ? "true" : "false")
                )}
            />
        </div>
    );
}

function StringParameter(props: ParameterProps<StringParameterObj>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <FormGroup
            label={parameter.name}
            inline
            labelFor={parameter.id}
            className="full-width"
        >
            <InputGroup
                id={parameter.id}
                value={value}
                onValueChange={onValueChange}
            />
        </FormGroup>
    );
}

function getEvaluateOptions(
    parameter: QuantityParameterObj,
    contextData: ContextData
): EvaluateOptions {
    const quantityType = parameter.quantityType;
    const minAndMax = {
        max: { value: parameter.max, type: getUnitType(parameter.unit) },
        min: { value: parameter.min, type: getUnitType(parameter.unit) }
    };
    if (quantityType === QuantityType.LENGTH) {
        return {
            quantityType,
            displayPrecision: contextData.lengthPrecision,
            displayUnit: contextData.lengthUnit,
            ...minAndMax
        };
    } else if (quantityType === QuantityType.ANGLE) {
        return {
            quantityType,
            displayPrecision: contextData.anglePrecision,
            displayUnit: contextData.angleUnit,
            ...minAndMax
        };
    } else if (quantityType == QuantityType.REAL) {
        return {
            quantityType,
            displayPrecision: contextData.realPrecision,
            displayUnit: Unit.UNITLESS,
            ...minAndMax
        };
    }
    return {
        quantityType: QuantityType.INTEGER,
        displayPrecision: 0,
        displayUnit: Unit.UNITLESS,
        ...minAndMax
    };
}

function QuantityParameter(
    props: ParameterProps<QuantityParameterObj>
): ReactNode {
    // This parameter doesn't actually use value since it manages it's state internally
    const { parameter, onValueChange } = props;

    const contextData = useSearch({ from: "/app" });

    const evaluateOptions = getEvaluateOptions(parameter, contextData);

    const ref = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);
    // The user's raw expression.
    const [expression, setExpression] = useState(parameter.default);

    // The pretty print value to display. Only shown when the input isn't focused.
    const [display, setDisplay] = useState(
        formatValueWithUnits(
            valueWithUnits(parameter.defaultValue, parameter.unit),
            evaluateOptions.displayUnit,
            evaluateOptions.displayPrecision
        )
    );

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
            onValueChange(result.expression);
            setDisplay(result.displayExpression);
        }
    }, [evaluateOptions, expression, onValueChange]);

    const intent = errorMessage ? "danger" : undefined;

    return (
        <FormGroup
            label={parameter.name}
            inline
            labelFor={parameter.id}
            className="full-width"
            helperText={errorMessage}
            intent={intent}
        >
            <NumericInput
                id={parameter.id}
                value={focused ? expression : display}
                fill
                intent={intent}
                inputRef={ref}
                selectAllOnFocus
                onFocus={() => {
                    setFocused(true);
                }}
                onBlur={handleSubmit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        ref.current?.blur();
                        handleSubmit();
                    }
                }}
                allowNumericCharactersOnly={false}
                onValueChange={(_, expression) => {
                    setExpression(expression);
                }}
                buttonPosition="none"
            />
        </FormGroup>
    );
}
