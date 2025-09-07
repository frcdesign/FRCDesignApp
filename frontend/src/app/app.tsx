import { queryClient } from "../query-client";
import { AppNavbar } from "../navbar/app-navbar";
import {
    Navigate,
    Outlet,
    useLoaderData,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { getBackgroundClass, getThemeClass } from "../api/onshape-params";
import { BlueprintProvider } from "@blueprintjs/core";
import { SettingsMenu } from "../navbar/settings-menu";
import { InsertMenu } from "../document/insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AddDocumentMenu } from "../document/add-document-menu";

export function BaseApp() {
    const result = useLoaderData({ from: "/app/" });

    return (
        <Navigate
            to="/app/documents"
            search={() => ({
                maxAccessLevel: result.maxAccessLevel,
                accessLevel: result.currentAccessLevel
            })}
        />
    );
}

export function App() {
    const search = useSearch({ from: "/app" });

    const themeClass = getThemeClass(search.theme);

    return (
        <BlueprintProvider
            portalClassName={themeClass}
            // Very important, context menus do not work with the default container :(
            portalContainer={document.getElementById("root")!}
        >
            <QueryClientProvider client={queryClient}>
                <div className={themeClass + " app-background"}>
                    <AppNavbar />
                    <div
                        className={
                            getBackgroundClass(search.theme) + " app-content"
                        }
                    >
                        <Outlet />
                        <SettingsMenu />
                        <InsertMenu />
                        <AddDocumentMenu />
                        <TanStackRouterDevtools />
                    </div>
                </div>
            </QueryClientProvider>
        </BlueprintProvider>
    );
}
