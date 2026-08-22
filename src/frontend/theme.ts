import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * FRCDesign brand green ramp (index 6 = #4cae4f, the brand color).
 * Generate replacements with https://mantine.dev/colors-generator if tuning.
 */
const frcGreen: MantineColorsTuple = [
    "#eef9ee",
    "#dcf1dc",
    "#b6e3b6",
    "#8dd48d",
    "#6bc86b",
    "#56c156",
    "#4cae4f",
    "#3f9942",
    "#318235",
    "#236b28"
];

/**
 * One theme for every library: the chrome is neutral and the brand green is an
 * accent on controls and the active tab, rather than a color per library.
 */
export const appTheme = createTheme({
    colors: { frcGreen },
    primaryColor: "frcGreen",
    autoContrast: true,
    cursorType: "pointer"
});
