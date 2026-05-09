import {
    createRootRoute,
    HeadContent,
    Outlet,
    Scripts
} from "@tanstack/react-router";
import { NotFoundError, RootAppError } from "../app/root-error";
import { IconPaths, Icons } from "@blueprintjs/icons";
import { FocusStyleManager } from "@blueprintjs/core";

import "normalize.css/normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "../main.scss";

const iconModules: Record<string, { default: IconPaths }> = import.meta.glob(
    [
        "../../node_modules/@blueprintjs/icons/lib/esm/generated/16px/paths/*.js",
        "../../node_modules/@blueprintjs/icons/lib/esm/generated/20px/paths/*.js"
    ],
    { eager: true }
);

Icons.setLoaderOptions({
    loader: async (name, size) =>
        iconModules[
            `../../node_modules/@blueprintjs/icons/lib/esm/generated/${size}px/paths/${name}.js`
        ].default
});

FocusStyleManager.onlyShowFocusOnTabs();

export const Route = createRootRoute({
    ssr: true,
    component: RootDocument,
    notFoundComponent: () => <NotFoundError />,
    errorComponent: () => <RootAppError isRoot />
});

function RootDocument() {
    return (
        <html>
            <head>
                <HeadContent />
            </head>
            <body>
                <Outlet />
                <Scripts />
            </body>
        </html>
    );
}
