import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
    // Disable SSR by default
    defaultSsr: false
}));
