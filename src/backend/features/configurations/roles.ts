/**
 * Parameters that are about how a part is derived or drawn rather than which
 * part it is. Onshape records nothing that says so, so they are recognized by
 * name; see `parameterRole`.
 */
import { type ConfigurationParameter, ParameterType } from "./contract";

export enum ParameterRole {
    /**
     * A text parameter a document adds so one part can be derived into a part
     * studio more than once: Onshape refuses a second derive of the same
     * configuration, and a unique value here makes each one different. Only a
     * text one: the app fills it with a unique value, which is text.
     */
    DERIVATION_VARIABLE = "derivation-variable",
    COLOR = "color",
    /** One of a color's R, G and B, when a part spells a color out as three. */
    COLOR_CHANNEL = "color-channel",
    TESSELLATION = "tessellation"
}

/** A color's channels, when a part spells one out as three parameters. */
const COLOR_CHANNELS = [
    ["r", "g", "b"],
    ["red", "green", "blue"]
];

function normalizedName(parameter: ConfigurationParameter): string {
    return parameter.name.trim().toLowerCase();
}

/**
 * The role a parameter plays, if any. A lone "R" or "B" could mean anything,
 * so a channel counts only beside its two siblings, which is what `parameters`
 * is for.
 */
export function parameterRole(
    parameter: ConfigurationParameter,
    parameters: ConfigurationParameter[] = []
): ParameterRole | undefined {
    const name = normalizedName(parameter);
    if (
        parameter.type === ParameterType.STRING &&
        name.includes("derivation")
    ) {
        return ParameterRole.DERIVATION_VARIABLE;
    }
    if (/\bcolou?r\b/.test(name)) {
        return ParameterRole.COLOR;
    }
    if (/tess?ell?ation/.test(name)) {
        return ParameterRole.TESSELLATION;
    }
    const names = new Set(parameters.map(normalizedName));
    const isChannel = COLOR_CHANNELS.some(
        (set) => set.includes(name) && set.every((entry) => names.has(entry))
    );
    return isChannel ? ParameterRole.COLOR_CHANNEL : undefined;
}

export function isDerivationVariable(
    parameter: ConfigurationParameter
): boolean {
    return parameterRole(parameter) === ParameterRole.DERIVATION_VARIABLE;
}
