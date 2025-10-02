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
import { SettingsMenu } from "../navbar/settings-menu";
import { InsertMenu } from "../insert/insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AddDocumentMenu } from "./add-document-menu";
import { useSettings } from "../queries";

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
