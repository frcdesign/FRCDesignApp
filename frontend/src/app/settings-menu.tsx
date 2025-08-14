import {
    Alert,
    Button,
    Dialog,
    DialogBody,
    DialogFooter,
    Divider,
    FormGroup,
    H6,
    Intent,
    MenuItem,
    TextArea
} from "@blueprintjs/core";
import { ReactNode, useMemo, useState } from "react";
import { AppMenu, useHandleCloseDialog } from "../api/search-params";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { showSuccessToast } from "./toaster";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { AccessLevel, hasMemberAccess } from "../api/backend-types";
import { ItemRenderer, Select } from "@blueprintjs/select";
import { capitalize } from "../common/utils";
import { handleStringChange } from "../common/handlers";

export function SettingsMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.SETTINGS_MENU) {
        return null;
    }
    return <SettingsMenuDialog />;
}

function SettingsMenuDialog(): ReactNode {
    const closeDialog = useHandleCloseDialog();

    const search = useSearch({ from: "/app" });

    let adminSettings = null;
    // Unlike most other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasMemberAccess(search.maxAccessLevel)) {
        adminSettings = (
            <>
                <H6>Admin Settings</H6>
                <Divider />
                <AdminSettings />
            </>
        );
    }

    const closeButton = (
        <Button
            text="Close"
            icon="cross"
            intent={Intent.PRIMARY}
            onClick={closeDialog}
        />
    );

    return (
        <Dialog
            className="settings-dialog"
            isOpen
            icon="cog"
            title="Settings"
            onClose={closeDialog}
        >
            <DialogBody>{adminSettings}</DialogBody>
            <DialogFooter minimal actions={closeButton} />
        </Dialog>
    );
}

function AdminSettings(): ReactNode {
    const search = useSearch({ from: "/app" });
    return (
        <>
            <AccessLevelSelect />
            {hasMemberAccess(search.accessLevel) ? (
                <>
                    <ReloadAllDocumentsButton force />
                    <ReloadAllDocumentsButton />
                    <AppConfig />
                </>
            ) : null}
        </>
    );
}

function AccessLevelSelect(): ReactNode {
    const search = useSearch({ from: "/app" });
    const pathname = useLocation().pathname;
    const navigate = useNavigate();

    const maxAccessLevel = search.maxAccessLevel;
    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const accessLevels = useMemo(() => {
        return maxAccessLevel === AccessLevel.ADMIN
            ? [AccessLevel.ADMIN, AccessLevel.MEMBER, AccessLevel.USER]
            : [AccessLevel.MEMBER, AccessLevel.USER];
    }, [maxAccessLevel]);

    const [activeLevel, setActiveLevel] = useState<AccessLevel | null>(
        search.accessLevel
    );

    const button = (
        <Button
            alignText="start"
            endIcon="caret-down"
            text={capitalize(search.accessLevel)}
        />
    );

    const renderAccessLevel: ItemRenderer<AccessLevel> = (
        accessLevel,
        { handleClick, handleFocus, modifiers, ref }
    ) => {
        const selected = search.accessLevel === accessLevel;
        return (
            <MenuItem
                key={accessLevel}
                ref={ref}
                onClick={handleClick}
                onFocus={handleFocus}
                active={modifiers.active}
                text={capitalize(accessLevel)}
                roleStructure="listoption"
                selected={selected}
                intent={selected ? Intent.PRIMARY : Intent.NONE}
            />
        );
    };

    const select = (
        <Select<AccessLevel>
            items={accessLevels}
            activeItem={activeLevel}
            onActiveItemChange={setActiveLevel}
            filterable={false}
            popoverProps={{ minimal: true }}
            itemRenderer={renderAccessLevel}
            onItemSelect={(accessLevel) => {
                navigate({ to: pathname, search: { accessLevel } });
            }}
        >
            {button}
        </Select>
    );

    return (
        <FormGroup label="Access Level" className="full-width" inline>
            {select}
        </FormGroup>
    );
}

interface ReloadAllDocumentsButtonProps {
    force?: boolean;
}

function ReloadAllDocumentsButton(
    props: ReloadAllDocumentsButtonProps
): ReactNode {
    const force = props.force ?? false;
    const mutation = useMutation({
        mutationKey: ["save-all-documents"],
        mutationFn: () => {
            return apiPost("/save-all-documents", {
                // Set a timeout of 5 minutes
                query: { force },
                signal: AbortSignal.timeout(5 * 60000)
            });
        },
        onSuccess: async (result) => {
            const savedElements = result["savedElements"];
            if (savedElements === 0) {
                showSuccessToast("All documents were already up to date.");
            } else {
                showSuccessToast(
                    "Successfully reloaded " + savedElements + " tabs."
                );
            }
            await queryClient.refetchQueries({ queryKey: ["documents"] });
        }
    });

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const alert = (
        <Alert
            confirmButtonText="Reload"
            icon="refresh"
            intent={force ? Intent.DANGER : Intent.PRIMARY}
            isOpen={isAlertOpen}
            canEscapeKeyCancel
            canOutsideClickCancel
            cancelButtonText="Cancel"
            onClose={(confirmed) => {
                if (confirmed) {
                    mutation.mutate();
                }
                setIsAlertOpen(false);
            }}
        >
            Are you sure you want to {force ? "force " : ""}reload all
            documents?
        </Alert>
    );

    return (
        <>
            <FormGroup
                label={
                    force
                        ? "Force reload all documents"
                        : "Reload all documents"
                }
                inline
            >
                <Button
                    icon="refresh"
                    text="Reload"
                    onClick={() => setIsAlertOpen(true)}
                    loading={mutation.isPending}
                    intent={force ? Intent.DANGER : Intent.PRIMARY}
                />
            </FormGroup>
            {alert}
        </>
    );
}

function AppConfig() {
    const [appConfig, setAppConfig] = useState({});
    const [currentValue, setCurrentValue] = useState("");

    const appConfigQuery = useQuery<object>({
        queryKey: ["app-config"],
        queryFn: async ({ signal }) => {
            const result = await apiGet("/app-config", {}, signal);
            setAppConfig(result);
            setCurrentValue(JSON.stringify(result, undefined, 4));
            return result;
        },
        refetchInterval: false
    });

    const mutation = useMutation({
        mutationKey: ["app-config"],
        mutationFn: () =>
            apiPost("/app-config", { body: JSON.parse(currentValue) }),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["app-config"] });
        }
    });

    if (appConfigQuery.isPending || !appConfig) {
        return null;
    }

    const submitButton = (
        <Button
            text="Save changes"
            icon="floppy-disk"
            intent="primary"
            disabled={
                !isValidJSON(currentValue) ||
                JSON.parse(currentValue) === appConfig
            }
            onClick={async () => {
                mutation.mutate();
            }}
        />
    );

    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <TextArea
                value={currentValue}
                onChange={handleStringChange(setCurrentValue)}
                autoResize
            />
            {submitButton}
        </div>
    );
}

function isValidJSON(text: string) {
    try {
        JSON.parse(text);
        return true;
    } catch (e) {
        return false;
    }
}
