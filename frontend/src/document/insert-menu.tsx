import { useSearch } from "@tanstack/react-router";
import { Dispatch, ReactNode, useState } from "react";
import {
    BooleanParameterObj,
    ConfigurationResult,
    ElementObj,
    ElementType,
    EnumOption,
    EnumParameterObj,
    evaluateCondition,
    ParameterObj,
    ConfigurationType,
    QuantityParameterObj,
    StringParameterObj,
    Configuration
} from "../api/backend-types";
import {
    Alignment,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogBody,
    DialogFooter,
    FormGroup,
    InputGroup,
    Intent,
    MenuItem,
    NumericInput,
    Spinner,
    Tooltip
} from "@blueprintjs/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api/api";
import { toElementApiPath } from "../api/path";
import { Select } from "@blueprintjs/select";
import { handleBooleanChange } from "../common/utils";
import { OpenUrlButton } from "../common/open-url-button";
import { makeUrl } from "../common/url";
import {
    useDocumentsQuery,
    useElementsQuery,
    useFavoritesQuery
} from "../queries";
import {
    AppMenu,
    InsertMenuParams,
    MenuDialogProps,
    useHandleCloseDialog
} from "../api/menu-params";
import { PreviewImage } from "../app/thumbnail";
import { FavoriteButton } from "../app/favorite";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast
} from "../common/toaster";

export function InsertMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.INSERT_MENU) {
        return null;
    }
    return <InsertMenuDialog activeElementId={search.activeElementId} />;
}

function InsertMenuDialog(props: MenuDialogProps<InsertMenuParams>): ReactNode {
    const elementId = props.activeElementId;

    const documents = useDocumentsQuery().data;
    const elements = useElementsQuery().data;
    const search = useSearch({ from: "/app" });
    const favorites = useFavoritesQuery(search).data;

    const closeDialog = useHandleCloseDialog();

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(undefined);

    if (!documents || !elements || !favorites) {
        return null;
    }

    const element = elements[elementId];
    const isFavorite = favorites[elementId] !== undefined;

    let parameters = null;
    if (element.configurationId) {
        parameters = (
            <ConfigurationWrapper
                configurationId={element.configurationId}
                configuration={configuration}
                setConfiguration={setConfiguration}
            />
        );
    }

    const previewThumbnail = (
        <PreviewImage
            isDialogPreview
            elementPath={element}
            configuration={configuration}
        />
    );

    const actions = (
        <>
            <OpenUrlButton url={makeUrl(element, configuration)} text="Open" />
            <InsertButton element={element} configuration={configuration} />
        </>
    );

    return (
        <Dialog
            isOpen
            title={element.name}
            onClose={closeDialog}
            style={{ maxHeight: "90vh", maxWidth: "400px" }}
        >
            <Card className="center preview-image-card">
                {previewThumbnail}
            </Card>
            <DialogBody>{parameters}</DialogBody>
            <DialogFooter actions={actions}>
                <FavoriteButton isFavorite={isFavorite} element={element} />
            </DialogFooter>
        </Dialog>
    );
}

interface ConfigurationWrapperProps {
    configurationId: string;
    configuration?: Configuration;
    setConfiguration: Dispatch<Configuration>;
}

function ConfigurationWrapper(props: ConfigurationWrapperProps) {
    const { configurationId, configuration, setConfiguration } = props;

    const query = useQuery<ConfigurationResult>({
        queryKey: ["configuration", configurationId],
        queryFn: async () => {
            const result = apiGet("/configuration/" + configurationId);
            return result.then((result: ConfigurationResult) => {
                const defaultConfiguration = result.parameters.reduce(
                    (configuration, parameter) => {
                        configuration[parameter.id] = parameter.default;
                        return configuration;
                    },
                    {} as Configuration
                );
                setConfiguration(defaultConfiguration);
                return result;
            });
        },
        // Disable refetch to avoid resetting defaults
        refetchInterval: false
    });

    if (!query.isSuccess || !configuration) {
        return <Spinner intent={Intent.PRIMARY} />;
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
        if (!evaluateCondition(parameter.visibilityCondition, configuration)) {
            return null;
        }
        return (
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
        );
    });
    return <div style={{ width: "100%" }}>{parameters}</div>;
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
    if (parameter.type === ConfigurationType.ENUM) {
        return (
            <EnumParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ConfigurationType.BOOLEAN) {
        return (
            <BooleanParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ConfigurationType.STRING) {
        return (
            <StringParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ConfigurationType.QUANTITY) {
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

    const [activeItem, setActiveItem] = useState<EnumOption | null>(
        selectedItem ?? null
    );

    return (
        <FormGroup
            label={parameter.name}
            labelFor={parameter.id}
            inline
            className="full-width"
        >
            <Select<EnumOption>
                items={parameter.options}
                activeItem={activeItem}
                onActiveItemChange={setActiveItem}
                filterable={false}
                fill
                popoverProps={{
                    minimal: true,
                    popoverClassName: "enum-menu"
                }}
                itemRenderer={(
                    enumOption,
                    { handleClick, handleFocus, modifiers, ref }
                ) => {
                    const selected = value === enumOption.id;
                    return (
                        <MenuItem
                            key={enumOption.id}
                            ref={ref}
                            onClick={handleClick}
                            onFocus={handleFocus}
                            active={modifiers.active}
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
                    id={parameter.id}
                    alignText="start"
                    endIcon="caret-down"
                    text={selectedItem?.name}
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

function isNumeric(str: string): boolean {
    return !isNaN(Number(str));
}

function QuantityParameter(
    props: ParameterProps<QuantityParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;

    const isInvalid = isNumeric(value) || value.trim() == "";

    return (
        <Tooltip
            disabled={!isInvalid}
            content="Enter a valid expression with units"
            isOpen
        >
            <FormGroup
                label={parameter.name}
                inline
                labelFor={parameter.id}
                className="full-width"
            >
                <NumericInput
                    id={parameter.id}
                    value={value}
                    fill
                    intent={isInvalid ? "danger" : undefined}
                    allowNumericCharactersOnly={false}
                    onValueChange={(_, value) => onValueChange(value)}
                    buttonPosition="none"
                />
            </FormGroup>
        </Tooltip>
    );
}

interface SubmitButtonProps {
    element: ElementObj;
    configuration?: Configuration;
}

function InsertButton(props: SubmitButtonProps): ReactNode {
    const { element, configuration } = props;

    const search = useSearch({ from: "/app" });
    const closeDialog = useHandleCloseDialog();

    const toastId = "insert" + element.id;

    const insertMutation = useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async () => {
            let endpoint;
            const body: Record<string, any> = {
                documentId: element.documentId,
                instanceType: element.instanceType,
                instanceId: element.instanceId,
                elementId: element.id,
                configuration
            };
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
                body.elementType = element.elementType;
            } else {
                // Part studio derive also needs name and microversion id
                endpoint = "/add-to-part-studio";
                body.name = element.name;
                body.microversionId = element.microversionId;
            }
            showLoadingToast(`Inserting ${element.name}...`, toastId);
            closeDialog();
            return apiPost(endpoint + toElementApiPath(search), {
                body
            });
        },
        onError: () => {
            showErrorToast(
                `Unexpectedly failed to insert ${element.name}.`,
                toastId
            );
        },
        onSuccess: () => {
            showSuccessToast(`Successfully inserted ${element.name}.`, toastId);
        }
    });

    return (
        <Button
            text="Insert"
            icon="plus"
            intent={Intent.SUCCESS}
            loading={insertMutation.isPending}
            onClick={() => insertMutation.mutate()}
        />
    );
}
