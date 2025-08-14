import { queryClient } from "../query-client";
import { AppNavbar } from "../navbar/app-navbar";
import { Navigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
    getBackgroundClass,
    getThemeClass,
    useOnshapeData
} from "../api/onshape-data";
import { BlueprintProvider } from "@blueprintjs/core";
import { SettingsMenu } from "./settings-menu";
import { InsertMenu } from "./insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export function App() {
    const matchRoute = useMatchRoute();
    const onshapeData = useOnshapeData();

    if (matchRoute({ to: "/app" })) {
        return <Navigate to="/app/documents" />;
    }

    const themeClass = getThemeClass(onshapeData.theme);

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
                            getBackgroundClass(onshapeData.theme) +
                            " app-content"
                        }
                    >
                        <Outlet />
                        <SettingsMenu />
                        <InsertMenu />
                        <TanStackRouterDevtools />
                    </div>
                </div>
            </QueryClientProvider>
        </BlueprintProvider>
    );
}
