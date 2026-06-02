import { createRoot } from "react-dom/client";

// Router
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

// Used to make static assets work in dev
import "vite/modulepreload-polyfill";

// Mantine css (layered so our custom styles in main.scss win the cascade)
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.layer.css";

// Custom css
import "./main.scss";

const rootElement: HTMLElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
    const root = createRoot(rootElement);
    root.render(<RouterProvider router={router} />);
}
