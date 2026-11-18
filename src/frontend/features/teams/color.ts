/**
 * One Color control in place of however a part spells its color: three
 * channel parameters, or one text parameter. A named-option list is left as
 * it is, since it can't take a color it doesn't name.
 */
import {
    type ConfigurationParameter,
    ParameterRole,
    ParameterType,
    type QuantityParameter,
    type Selection,
    type StringParameter
} from "@backend/features/configurations/contract";

export type ColorControl =
    | {
          kind: "channels";
          /** Red, green and blue, in that order. */
          channels: [QuantityParameter, QuantityParameter, QuantityParameter];
      }
    | { kind: "text"; parameter: StringParameter };

const CHANNEL_NAMES = [
    ["r", "red"],
    ["g", "green"],
    ["b", "blue"]
];

function channelOf(parameter: ConfigurationParameter): number {
    const name = parameter.name.trim().toLowerCase();
    return CHANNEL_NAMES.findIndex((names) => names.includes(name));
}

export function findColorControl(
    parameters: ConfigurationParameter[]
): ColorControl | undefined {
    const channels = parameters.filter(
        (parameter): parameter is QuantityParameter =>
            parameter.role === ParameterRole.COLOR_CHANNEL &&
            parameter.type === ParameterType.QUANTITY
    );
    const ordered = [0, 1, 2].map((index) =>
        channels.find((channel) => channelOf(channel) === index)
    );
    if (ordered.every((channel) => channel !== undefined)) {
        return {
            kind: "channels",
            channels: ordered as [
                QuantityParameter,
                QuantityParameter,
                QuantityParameter
            ]
        };
    }
    const text = parameters.find(
        (parameter): parameter is StringParameter =>
            parameter.role === ParameterRole.COLOR &&
            parameter.type === ParameterType.STRING
    );
    return text ? { kind: "text", parameter: text } : undefined;
}

/** The parameters the control stands in for, the first of which it is drawn at. */
export function controlledParameters(
    control: ColorControl
): ConfigurationParameter[] {
    return control.kind === "channels" ? control.channels : [control.parameter];
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** A channel's 0–255 as its parameter takes it: 0–1 when its maximum is 1. */
function scaleOf(channel: QuantityParameter): number {
    return channel.max <= 1 ? 1 / 255 : 1;
}

function toHex(channels: number[]): string {
    return (
        "#" +
        channels
            .map((value) =>
                Math.round(Math.min(255, Math.max(0, value)))
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("")
    );
}

/** `#rrggbb`, or undefined for a value that spells no color. */
export function readColor(
    control: ColorControl,
    selection: Selection
): string | undefined {
    if (control.kind === "text") {
        const value = selection[control.parameter.id]?.trim();
        return value && HEX.test(value) ? value.toLowerCase() : undefined;
    }
    const values = control.channels.map(
        (channel) => Number.parseFloat(selection[channel.id]) / scaleOf(channel)
    );
    return values.every(Number.isFinite) ? toHex(values) : undefined;
}

export function writeColor(
    control: ColorControl,
    selection: Selection,
    hex: string
): Selection {
    const match = HEX.exec(hex);
    if (!match) return selection;
    if (control.kind === "text") {
        return { ...selection, [control.parameter.id]: hex.toLowerCase() };
    }
    const next = { ...selection };
    control.channels.forEach((channel, index) => {
        const value = Number.parseInt(match[index + 1], 16) * scaleOf(channel);
        next[channel.id] = String(Number(value.toFixed(4)));
    });
    return next;
}
