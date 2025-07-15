import { queryClient } from "../query-client";
import { AppNavbar } from "./app-navbar";
import { Navigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { getThemeClass, useOnshapeData } from "../api/onshape-data";
import { BlueprintProvider, Section } from "@blueprintjs/core";
import { AdminPanel } from "./admin-panel";
import { InsertMenu } from "./insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export function App() {
    const matchRoute = useMatchRoute();
    const onshapeData = useOnshapeData();

    if (matchRoute({ to: "/app" })) {
        return <Navigate to="/app/documents" />;
    }

    return (
        <>
            <BlueprintProvider
                portalClassName={getThemeClass(onshapeData.theme)}
            >
                <QueryClientProvider client={queryClient}>
                    <Section
                        className={
                            getThemeClass(onshapeData.theme) + " app-container"
                        }
                    >
                        <div className="app-background">
                            <AppNavbar />
                            <div className="app-content">
                                <Outlet />
                                <AdminPanel />
                                <InsertMenu />
                                <TanStackRouterDevtools />
                            </div>
                        </div>
                    </Section>
                </QueryClientProvider>
            </BlueprintProvider>
        </>
    );
}
