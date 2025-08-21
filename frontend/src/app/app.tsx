import { queryClient } from "../query-client";
import { AppNavbar } from "../navbar/app-navbar";
import {
    Navigate,
    Outlet,
    useMatchRoute,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { getBackgroundClass, getThemeClass } from "../api/onshape-params";
import { BlueprintProvider } from "@blueprintjs/core";
import { SettingsMenu } from "../navbar/settings-menu";
import { InsertMenu } from "../document/insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AddDocumentMenu } from "../document/add-document-menu";

export function App() {
    const matchRoute = useMatchRoute();
    const search = useSearch({ from: "/app" });

    if (matchRoute({ to: "/app" })) {
        return <Navigate to="/app/documents" />;
    }

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
