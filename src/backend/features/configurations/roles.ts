/** Onshape doesn't mark roles, so they're recognized by name at load and stored as `role`. */
import {
    type ConfigurationParameter,
    ParameterRole,
    ParameterType
} from "./contract";

/** A color's channels, when a part spells one out as three parameters. */
const COLOR_CHANNELS = [
    ["r", "g", "b"],
    ["red", "green", "blue"]
];

function normalizedName(parameter: ConfigurationParameter): string {
    return parameter.name.trim().toLowerCase();
}

/** A channel counts only beside its two siblings. A derivation variable must be text, since the app fills it with a UUID. */
function identifyRole(
    parameter: ConfigurationParameter,
    names: Set<string>
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
    const isChannel = COLOR_CHANNELS.some(
        (set) => set.includes(name) && set.every((entry) => names.has(entry))
    );
    return isChannel ? ParameterRole.COLOR_CHANNEL : undefined;
}

/** An insertable's parameters, each carrying the role it was recognized in. */
export function withRoles(
    parameters: ConfigurationParameter[]
): ConfigurationParameter[] {
    const names = new Set(parameters.map(normalizedName));
    return parameters.map((parameter) => {
        const role = identifyRole(parameter, names);
        return role ? { ...parameter, role } : parameter;
    });
}

export function isDerivationVariable(
    parameter: ConfigurationParameter
): boolean {
    return parameter.role === ParameterRole.DERIVATION_VARIABLE;
}
