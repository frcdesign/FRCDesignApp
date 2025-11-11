import { queryClient } from "../query-client";
import { AppNavbar } from "../navbar/app-navbar";
import { Outlet, useSearch } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
    getBackgroundClass,
    getColorTheme,
    getThemeClass
} from "../api/onshape-params";
import { BlueprintProvider } from "@blueprintjs/core";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppAlerts } from "../overlays/app-popups";
import { useUserData } from "../queries";
import { AppMenus } from "../overlays/app-menus";
import { useMessageListener } from "../api/messages";

export function App() {
    const search = useSearch({ from: "/app" });
    const settings = useUserData().settings;
    const colorTheme = getColorTheme(settings.theme, search.systemTheme);
    const themeClass = getThemeClass(colorTheme);

    useMessageListener();

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
                        <AppAlerts />
                        <AppMenus />
                        <TanStackRouterDevtools />
                    </div>
                </div>
            </BlueprintProvider>
        </QueryClientProvider>
    );
}
