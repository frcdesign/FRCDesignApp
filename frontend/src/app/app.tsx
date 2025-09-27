import { queryClient } from "../query-client";
import { AppNavbar } from "../navbar/app-navbar";
import {
    Navigate,
    Outlet,
    useLoaderData,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
    getBackgroundClass,
    getColorTheme,
    getThemeClass
} from "../api/onshape-params";
import { BlueprintProvider } from "@blueprintjs/core";
import { SettingsMenu } from "../navbar/settings-menu";
import { InsertMenu } from "../document/insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AddDocumentMenu } from "../document/add-document-menu";
import { useSettings } from "../queries";
import { useUiState } from "./ui-state";

export function BaseApp() {
    const contextData = useLoaderData({ from: "/app/" });

    const uiState = useUiState()[0];

    if (uiState.openDocumentId) {
        return (
            <Navigate
                to="/app/documents/$documentId"
                params={{ documentId: uiState.openDocumentId }}
                search={() => contextData}
            />
        );
    }

    return <Navigate to="/app/documents" search={() => contextData} />;
}

export function App() {
    const search = useSearch({ from: "/app" });
    const settings = useSettings();
    const colorTheme = getColorTheme(settings.theme, search.systemTheme);
    const themeClass = getThemeClass(colorTheme);

    return (
        <QueryClientProvider client={queryClient}>
            <BlueprintProvider
                portalClassName={themeClass}
                // Very important, context menus do not work with the default container :(
                portalContainer={document.getElementById("root")!}
            >
                <div className={themeClass + " app-background"}>
                    <AppNavbar />
                    <div
                        className={
                            getBackgroundClass(colorTheme) + " app-content"
                        }
                    >
                        <Outlet />
                        <SettingsMenu />
                        <InsertMenu />
                        <AddDocumentMenu />
                        <TanStackRouterDevtools />
                    </div>
                </div>
            </BlueprintProvider>
        </QueryClientProvider>
    );
}
