import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconPaths, Icons } from "@blueprintjs/icons";

// Router
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

// Used to make static assets work in dev
import "vite/modulepreload-polyfill";

// Blueprint css
import "normalize.css/normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";

// Custom css
import "./main.scss";
import { FocusStyleManager } from "@blueprintjs/core";

// See also: https://vitejs.dev/guide/features.html#glob-import
// And: https://blueprintjs.com/docs/#icons/loading-icons
const iconModules: Record<string, { default: IconPaths }> = import.meta.glob(
    [
        "../node_modules/@blueprintjs/icons/lib/esm/generated/16px/paths/*.js",
        "../node_modules/@blueprintjs/icons/lib/esm/generated/20px/paths/*.js"
    ],
    { eager: true }
);

Icons.setLoaderOptions({
    loader: async (name, size) =>
        iconModules[
            `../node_modules/@blueprintjs/icons/lib/esm/generated/${size}px/paths/${name}.js`
        ].default
});

FocusStyleManager.onlyShowFocusOnTabs();

const container: HTMLElement = document.getElementById("root")!;
const root = createRoot(container);
root.render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
