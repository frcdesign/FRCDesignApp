import { Center, Checkbox, Loader, Select, TextInput } from "@mantine/core";
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
import { useCacheOptions, apiGet } from "../api-utils/api";
import {
    Configuration,
    ConfigurationResult,
    ParameterObj,
    ConfigurationParameterType,
    EnumParameterObj,
    OptionVisibilityConditionType,
    BooleanParameterObj,
    StringParameterObj,
    QuantityParameterObj,
    UnitInfo,
    QuantityType,
    Unit,
    EnumOption
} from "../../shared/configuration-models";
import { evaluateCondition } from "../../shared/configuration-utils";
import { handleBooleanChange } from "../common/utils";
import {
    EvaluateOptions,
    formatValueWithUnits,
    valueWithUnits,
    evaluateExpression
} from "../insert/input-parser";
import { getConfigurationKey, useUnitInfoQuery } from "../queries";
import { showErrorToast } from "../common/toaster";
import { SectionError } from "../common/app-zero-state";
import { useLibrary } from "../api-utils/library";

interface ConfigurationWrapperProps {
    configurationId: string;
    configuration?: Configuration;
    setConfiguration: Dispatch<Configuration>;
}

export function ConfigurationWrapper(props: ConfigurationWrapperProps) {
    const { configurationId, configuration, setConfiguration } = props;

    const library = useLibrary();
    const cacheOptions = useCacheOptions();
    const query = useQuery<ConfigurationResult>({
        queryKey: getConfigurationKey(library, configurationId, cacheOptions),
        queryFn: async () => {
            return apiGet("/configuration/" + configurationId, {
                cacheOptions
            });
        },
        // Don't refetch query automatically so we don't reset user inputs
        refetchInterval: false
    });

    const search = useSearch({ from: "/app" });
    const unitInfoQuery = useUnitInfoQuery(search);

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

    if (query.isPending || unitInfoQuery.isPending || !configuration) {
        return (
            <Center my="md">
                <Loader />
            </Center>
        );
    } else if (query.isError || unitInfoQuery.isError) {
        return <SectionError title="Failed to load configuration" />;
    }

    return (
        <ConfigurationParameters
            configurationResult={query.data}
            configuration={configuration}
            setConfiguration={setConfiguration}
            unitInfo={unitInfoQuery.data}
        />
    );
}

interface ConfigurationParameterProps {
    configurationResult: ConfigurationResult;
    configuration: Configuration;
    setConfiguration: Dispatch<Configuration>;
    unitInfo: UnitInfo;
}

function ConfigurationParameters(props: ConfigurationParameterProps) {
    const { configurationResult, configuration, setConfiguration, unitInfo } =
        props;

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
                unitInfo={unitInfo}
            />
        );
    });
    return <div>{parameters}</div>;
}

interface ParameterProps<T extends ParameterObj> {
    parameter: T;
    value: string;
    onValueChange: (newValue: string | undefined) => void;
    configuration: Configuration;
    parameters: ParameterObj[];
    unitInfo: UnitInfo;
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

function getFirstVisibleOption(
    visibleOptions: EnumOption[],
    currentOptionId: string,
    defaultOptionId: string
): EnumOption | undefined {
    if (visibleOptions.length === 0) {
        return undefined;
    }
    const currentOption = getOption(visibleOptions, currentOptionId);
    if (currentOption) {
        return currentOption;
    }
    const defaultOption = getOption(visibleOptions, defaultOptionId);
    if (defaultOption) {
        return defaultOption;
    }
    return visibleOptions[0];
}

function EnumParameter(props: ParameterProps<EnumParameterObj>): ReactNode {
    const { parameter, value, onValueChange, configuration, parameters } =
        props;

    const visibleOptions = getVisibleOptions(
        parameter,
        configuration,
        parameters
    );

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
        <Select
            label={parameter.name}
            id={parameter.id}
            data={visibleOptions.map((option) => ({
                value: option.id,
                label: option.name
            }))}
            value={currentOption.id}
            allowDeselect={false}
            mt="sm"
            checkIconPosition="right"
            maxDropdownHeight={250}
            comboboxProps={{ withinPortal: true }}
            onChange={(newValue) => {
                if (newValue !== null) {
                    onValueChange(newValue);
                }
            }}
        />
    );
}

function BooleanParameter(
    props: ParameterProps<BooleanParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;
    // Add a 100% width div to eat up space to the right of the checkbox
    // Otherwise multiple checkboxes in a row can fold onto the same line
    return (
        <Checkbox
            label={parameter.name}
            labelPosition="left"
            checked={value === "true"}
            mt="sm"
            onChange={handleBooleanChange((checked) =>
                onValueChange(checked ? "true" : "false")
            )}
        />
    );
}

function StringParameter(props: ParameterProps<StringParameterObj>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <TextInput
            label={parameter.name}
            id={parameter.id}
            mt="sm"
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
        />
    );
}

function getEvaluateOptions(
    parameter: QuantityParameterObj,
    contextData: UnitInfo
): EvaluateOptions {
    const quantityType = parameter.quantityType;
    const minAndMax = {
        min: valueWithUnits(parameter.min, parameter.unit),
        max: valueWithUnits(parameter.max, parameter.unit)
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
            onValueChange(result.expression);
            setDisplay(result.displayExpression);
        }
    }, [evaluateOptions, expression, onValueChange]);

    return (
        <TextInput
            label={parameter.name}
            id={parameter.id}
            ref={ref}
            value={focused ? expression : display}
            error={errorMessage}
            mt="sm"
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
    );
}
