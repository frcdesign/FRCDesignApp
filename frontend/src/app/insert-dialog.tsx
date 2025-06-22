import {
    useLoaderData,
    useNavigate,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { Dispatch, ReactNode, useState } from "react";
import {
    BooleanParameterObj,
    ConfigurationResult,
    ElementObj,
    ElementType,
    EnumOption,
    EnumParameterObj,
    ParameterObj,
    ParameterType,
    QuantityParameterObj,
    StringParameterObj
} from "../api/backend-types";
import {
    Alignment,
    Button,
    Checkbox,
    Dialog,
    DialogBody,
    DialogFooter,
    FormGroup,
    InputGroup,
    Intent,
    MenuItem,
    NumericInput
} from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { toElementApiPath } from "../api/path";
import { Select } from "@blueprintjs/select";
import { handleBooleanChange } from "../common/handlers";
import { getThemeClass } from "../api/search-params";
import { ElementThumbnail } from "./thumbnail";

export function ConfigurationDialog(): ReactNode {
    const documentResult = useLoaderData({
        from: "/app/documents"
    });
    const configurationResult = useLoaderData({
        from: "/app/documents/$elementId"
    });
    const elementId = useParams({
        from: "/app/documents/$elementId"
    }).elementId;

    const [configuration, setConfiguration] = useState<Record<string, string>>(
        () => {
            const configuration: Record<string, string> = {};
            configurationResult?.parameters.forEach((parameter) => {
                configuration[parameter.id] = parameter.default;
            });
            return configuration;
        }
    );

    const navigate = useNavigate();
    const search = useSearch({ from: "/app" });

    const element = documentResult.elements.find(
        (element) => element.id === elementId
    );

    if (!element || (element.configurationId && !configurationResult)) {
        // Error if we don't have an element or we're missing our configurationResult
        return null;
    }

    let parameters = null;
    if (configurationResult) {
        parameters = (
            <ConfigurationParameters
                configurationResult={configurationResult}
                configuration={configuration}
                setConfiguration={setConfiguration}
            />
        );
    }

    const previewImage = (
        <ElementThumbnail
            isDialogPreview
            elementPath={element}
            configuration={configuration}
        />
    );

    const submitButton = (
        <InsertButton element={element} configuration={configuration} />
    );
    return (
        <Dialog
            className={getThemeClass(search.theme)}
            isOpen
            title={element.name}
            onClose={() => navigate({ to: "/app/documents" })}
        >
            <DialogBody>
                <>
                    {parameters}
                    <div className="center">{previewImage}</div>
                </>
            </DialogBody>
            <DialogFooter minimal actions={submitButton} />
        </Dialog>
    );
}

interface ConfigurationParameterProps {
    configurationResult: ConfigurationResult;
    configuration: Record<string, string>;
    setConfiguration: Dispatch<Record<string, string>>;
}

function ConfigurationParameters(props: ConfigurationParameterProps) {
    const { configurationResult, configuration, setConfiguration } = props;

    const parameters = configurationResult.parameters.map((parameter) => (
        <ConfigurationParameter
            key={parameter.id}
            parameter={parameter}
            value={configuration[parameter.id]}
            onValueChange={(newValue) => {
                const newConfiguration = {
                    ...configuration,
                    [parameter.id]: newValue
                };
                setConfiguration(newConfiguration);
            }}
        />
    ));
    return parameters;
}

interface ParameterProps<T extends ParameterObj> {
    parameter: T;
    value: string;
    onValueChange: (newValue: string) => void;
}

function ConfigurationParameter(
    props: ParameterProps<ParameterObj>
): ReactNode {
    // Need to expose parameter directly to get type narrowing
    const { parameter, value, onValueChange } = props;
    if (parameter.type === ParameterType.ENUM) {
        return (
            <EnumParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ParameterType.BOOLEAN) {
        return (
            <BooleanParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ParameterType.STRING) {
        return (
            <StringParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ParameterType.QUANTITY) {
        return (
            <QuantityParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    }
}

function EnumParameter(props: ParameterProps<EnumParameterObj>): ReactNode {
    const { parameter, value, onValueChange } = props;
    const selectedItem = parameter.options.find(
        (enumOption) => enumOption.id === value
    );
    return (
        <FormGroup label={parameter.name}>
            <Select<EnumOption>
                items={parameter.options}
                filterable={false}
                popoverProps={{ minimal: true, popoverClassName: "enum-menu" }}
                itemRenderer={(enumOption, { handleClick, handleFocus }) => {
                    const selected = value === enumOption.id;
                    return (
                        <MenuItem
                            key={enumOption.id}
                            onClick={handleClick}
                            onFocus={handleFocus}
                            text={enumOption.name}
                            roleStructure="listoption"
                            selected={selected}
                            intent={selected ? Intent.PRIMARY : Intent.NONE}
                        />
                    );
                }}
                onItemSelect={(enumOption) => {
                    onValueChange(enumOption.id);
                }}
            >
                <Button
                    alignText="start"
                    endIcon="caret-down"
                    text={selectedItem?.name}
                />
            </Select>
        </FormGroup>
    );
}

function BooleanParameter(
    props: ParameterProps<BooleanParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <Checkbox
            label={parameter.name}
            alignIndicator={Alignment.START}
            checked={value === "true"}
            onChange={handleBooleanChange((checked) =>
                onValueChange(checked ? "true" : "false")
            )}
        />
    );
}

function StringParameter(props: ParameterProps<StringParameterObj>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <FormGroup label={parameter.name} labelFor={parameter.id}>
            <InputGroup
                id={parameter.id}
                value={value}
                onValueChange={onValueChange}
            />
        </FormGroup>
    );
}

function QuantityParameter(
    props: ParameterProps<QuantityParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <FormGroup label={parameter.name} labelFor={parameter.id}>
            <NumericInput
                id={parameter.id}
                value={value}
                allowNumericCharactersOnly={false}
                onValueChange={(_, value) => onValueChange(value)}
                buttonPosition="none"
            />
        </FormGroup>
    );
}

interface SubmitButtonProps {
    element: ElementObj;
    configuration?: Record<string, string>;
}

function InsertButton(props: SubmitButtonProps): ReactNode {
    const { element, configuration } = props;

    const search = useSearch({ from: "/app" });
    const navigate = useNavigate();

    const insertMutation = useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async () => {
            let endpoint;
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
            } else {
                endpoint = "/add-to-part-studio";
            }
            return apiPost(endpoint + toElementApiPath(search), {
                body: {
                    ...element,
                    configuration
                }
            });
        },
        onSuccess: () => {
            navigate({ to: "/app/documents" });
        }
    });

    return (
        <Button
            intent={Intent.PRIMARY}
            text="Insert"
            endIcon="plus"
            loading={insertMutation.isPending}
            onClick={() => insertMutation.mutate()}
        />
    );
}
