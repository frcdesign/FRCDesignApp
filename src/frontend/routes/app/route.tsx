import {
    createFileRoute,
    Outlet,
    retainSearchParams,
    type SearchSchemaInput
} from "@tanstack/react-router";
import { AppShell } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { queryClient } from "../../query-client";
import { getContextDataQuery } from "../../queries";
import { OnshapeParams } from "../../api-utils/onshape-params";
import { AppNavbar } from "../../app/app-navbar";
import { useMessageListener } from "../../api-utils/messages";
import { RootAppError } from "../../app/root-error";
import { PrimaryColor } from "../../common/style-constants";
import { type ContextData } from "../../../shared/types";

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        return search as unknown as OnshapeParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    },
    beforeLoad: async () => {
        // The auth-gated entry redirect lives in the `/init` route; here we just
        // expose the access level to child loaders/components.
        const contextData = await queryClient.ensureQueryData(
            getContextDataQuery()
        );
        return contextData;
    },
    // Library data is fetched by the `/app/library/$libraryId` route instead, so
    // the shell renders as soon as the context data is known.
    loader: ({ context }): ContextData => context,
    errorComponent: RootAppError
});

function App() {
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();

    return (
        <AppShell header={{ height: headerHeight || 56 }}>
            <AppShell.Header bg={PrimaryColor.FILLED} c={PrimaryColor.CONTRAST}>
                <div ref={headerRef}>
                    <AppNavbar />
                </div>
            </AppShell.Header>
            {/* Cap the main region at one viewport so it (not the window)
                scrolls; the fixed header covers the top of this scrollbar,
                keeping it within the body. */}
            <AppShell.Main h="100dvh" style={{ overflowY: "auto" }}>
                <Outlet />
                <TanStackRouterDevtools />
            </AppShell.Main>
        </AppShell>
    );
}
