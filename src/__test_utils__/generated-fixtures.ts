/**
 * The nut studio's part of a released fasteners manifest (`fasteners.parts.json`),
 * as robot-code writes it beside the Part Studios, from robot-code@20a5d8bf's
 * manifest. Its tab is `NUT_TAB` until a test names its own.
 */
export const NUT_TAB = "NUT_TAB";

export const NUT_MANIFEST = {
    studios: {
        nut: {
            feature: "fastenerNut",
            mateConnector: "mateConnector",
            elementId: "NUT_TAB",
            configuration: {
                btType: "BTConfigurationUpdateCall-2933",
                configurationParameters: [
                    {
                        btType: "BTMConfigurationParameterEnum-105",
                        parameterId: "vendor",
                        parameterName: "Vendor",
                        enumName: "vendor_conf",
                        namespace: "",
                        defaultValue: "GENERIC",
                        options: [
                            {
                                btType: "BTMEnumOption-592",
                                option: "GENERIC",
                                optionName: "Generic"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "MCMASTER",
                                optionName: "McMaster-Carr"
                            }
                        ]
                    },
                    {
                        btType: "BTMConfigurationParameterEnum-105",
                        parameterId: "size",
                        parameterName: "Size",
                        enumName: "size_conf",
                        namespace: "",
                        defaultValue: "NO_10_32",
                        options: [
                            {
                                btType: "BTMEnumOption-592",
                                option: "NO_4_40",
                                optionName: "#4-40"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "NO_6_32",
                                optionName: "#6-32"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "NO_8_32",
                                optionName: "#8-32"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "NO_10_32",
                                optionName: "#10-32"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "QUARTER_20",
                                optionName: "1/4-20"
                            }
                        ]
                    },
                    {
                        btType: "BTMConfigurationParameterEnum-105",
                        parameterId: "type",
                        parameterName: "Type",
                        enumName: "type_conf",
                        namespace: "",
                        defaultValue: "NYLOCK",
                        options: [
                            {
                                btType: "BTMEnumOption-592",
                                option: "NYLOCK",
                                optionName: "Nylock"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "THIN_NYLOCK",
                                optionName: "Thin nylock"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "HEX",
                                optionName: "Hex"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "THIN_HEX",
                                optionName: "Thin hex"
                            },
                            {
                                btType: "BTMEnumOption-592",
                                option: "SQUARE",
                                optionName: "Square"
                            }
                        ],
                        enumOptionVisibilityConditions: {
                            btType: "BTEnumOptionVisibilityConditionList-2936",
                            visibilityConditions: [
                                {
                                    btType: "BTEnumOptionVisibilityForList-1613",
                                    controlledOptions: ["THIN_HEX"],
                                    condition: {
                                        btType: "BTParameterVisibilityLogical-178",
                                        operation: "AND",
                                        children: [
                                            {
                                                btType: "BTParameterVisibilityLogical-178",
                                                operation: "OR",
                                                children: [
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "vendor",
                                                        value: "GENERIC",
                                                        inArray: false
                                                    },
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "vendor",
                                                        value: "MCMASTER",
                                                        inArray: false
                                                    }
                                                ]
                                            },
                                            {
                                                btType: "BTParameterVisibilityLogical-178",
                                                operation: "OR",
                                                children: [
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "size",
                                                        value: "NO_4_40",
                                                        inArray: false
                                                    },
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "size",
                                                        value: "NO_6_32",
                                                        inArray: false
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                },
                                {
                                    btType: "BTEnumOptionVisibilityForList-1613",
                                    controlledOptions: ["SQUARE"],
                                    condition: {
                                        btType: "BTParameterVisibilityLogical-178",
                                        operation: "AND",
                                        children: [
                                            {
                                                btType: "BTParameterVisibilityLogical-178",
                                                operation: "OR",
                                                children: [
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "vendor",
                                                        value: "GENERIC",
                                                        inArray: false
                                                    },
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "vendor",
                                                        value: "MCMASTER",
                                                        inArray: false
                                                    }
                                                ]
                                            },
                                            {
                                                btType: "BTParameterVisibilityLogical-178",
                                                operation: "OR",
                                                children: [
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "size",
                                                        value: "NO_10_32",
                                                        inArray: false
                                                    },
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "size",
                                                        value: "NO_8_32",
                                                        inArray: false
                                                    },
                                                    {
                                                        btType: "BTParameterVisibilityOnEqual-180",
                                                        parameterId: "size",
                                                        value: "QUARTER_20",
                                                        inArray: false
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                },
                                {
                                    btType: "BTEnumOptionVisibilityForList-1613",
                                    controlledOptions: [
                                        "NYLOCK",
                                        "THIN_NYLOCK",
                                        "HEX"
                                    ],
                                    condition: {
                                        btType: "BTParameterVisibilityLogical-178",
                                        operation: "AND",
                                        children: [
                                            {
                                                btType: "BTParameterVisibilityAlwaysShown-5487"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            records: [
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_4_40",
                        type: "NYLOCK"
                    },
                    name: "#4-40 Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_4_40",
                        type: "THIN_NYLOCK"
                    },
                    name: "#4-40 Thin Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_4_40",
                        type: "HEX"
                    },
                    name: "#4-40 Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_4_40",
                        type: "THIN_HEX"
                    },
                    name: "#4-40 Thin Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_6_32",
                        type: "NYLOCK"
                    },
                    name: "#6-32 Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_6_32",
                        type: "THIN_NYLOCK"
                    },
                    name: "#6-32 Thin Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_6_32",
                        type: "HEX"
                    },
                    name: "#6-32 Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_6_32",
                        type: "THIN_HEX"
                    },
                    name: "#6-32 Thin Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_8_32",
                        type: "NYLOCK"
                    },
                    name: "#8-32 Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_8_32",
                        type: "THIN_NYLOCK"
                    },
                    name: "#8-32 Thin Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_8_32",
                        type: "HEX"
                    },
                    name: "#8-32 Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_8_32",
                        type: "SQUARE"
                    },
                    name: "#8-32 Square Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_10_32",
                        type: "NYLOCK"
                    },
                    name: "#10-32 Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_10_32",
                        type: "THIN_NYLOCK"
                    },
                    name: "#10-32 Thin Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_10_32",
                        type: "HEX"
                    },
                    name: "#10-32 Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "NO_10_32",
                        type: "SQUARE"
                    },
                    name: "#10-32 Square Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "QUARTER_20",
                        type: "NYLOCK"
                    },
                    name: "1/4-20 Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "QUARTER_20",
                        type: "THIN_NYLOCK"
                    },
                    name: "1/4-20 Thin Nylock Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "QUARTER_20",
                        type: "HEX"
                    },
                    name: "1/4-20 Hex Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "GENERIC",
                        size: "QUARTER_20",
                        type: "SQUARE"
                    },
                    name: "1/4-20 Square Nut",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_4_40",
                        type: "NYLOCK"
                    },
                    name: "#4-40 Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90631A005",
                    url: "https://www.mcmaster.com/90631A005/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_4_40",
                        type: "THIN_NYLOCK"
                    },
                    name: "#4-40 Thin Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90633A005",
                    url: "https://www.mcmaster.com/90633A005/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_4_40",
                        type: "HEX"
                    },
                    name: "#4-40 Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90480A005",
                    url: "https://www.mcmaster.com/90480A005/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_4_40",
                        type: "THIN_HEX"
                    },
                    name: "#4-40 Thin Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90760A005",
                    url: "https://www.mcmaster.com/90760A005/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_6_32",
                        type: "NYLOCK"
                    },
                    name: "#6-32 Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90631A007",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_6_32",
                        type: "THIN_NYLOCK"
                    },
                    name: "#6-32 Thin Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90633A007",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_6_32",
                        type: "HEX"
                    },
                    name: "#6-32 Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90480A007",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_6_32",
                        type: "THIN_HEX"
                    },
                    name: "#6-32 Thin Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90760A007",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_8_32",
                        type: "NYLOCK"
                    },
                    name: "#8-32 Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90631A009",
                    url: "https://www.mcmaster.com/90631A009/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_8_32",
                        type: "THIN_NYLOCK"
                    },
                    name: "#8-32 Thin Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90633A009",
                    url: "https://www.mcmaster.com/90633A009/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_8_32",
                        type: "HEX"
                    },
                    name: "#8-32 Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90480A009",
                    url: "https://www.mcmaster.com/90480A009/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_8_32",
                        type: "SQUARE"
                    },
                    name: "#8-32 Square Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "94855A216",
                    url: "https://www.mcmaster.com/94855A216/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_10_32",
                        type: "NYLOCK"
                    },
                    name: "#10-32 Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90631A411",
                    url: "https://www.mcmaster.com/90631A411/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_10_32",
                        type: "THIN_NYLOCK"
                    },
                    name: "#10-32 Thin Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90633A411",
                    url: "https://www.mcmaster.com/90633A411/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_10_32",
                        type: "HEX"
                    },
                    name: "#10-32 Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90480A195",
                    url: "https://www.mcmaster.com/90480A195/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "NO_10_32",
                        type: "SQUARE"
                    },
                    name: "#10-32 Square Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "94855A283",
                    url: "https://www.mcmaster.com/94855A283/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "QUARTER_20",
                        type: "NYLOCK"
                    },
                    name: "1/4-20 Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90640A129",
                    url: "https://www.mcmaster.com/90640A129/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "QUARTER_20",
                        type: "THIN_NYLOCK"
                    },
                    name: "1/4-20 Thin Nylock Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90566A029",
                    url: "https://www.mcmaster.com/90566A029/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "QUARTER_20",
                        type: "HEX"
                    },
                    name: "1/4-20 Hex Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90494A029",
                    url: "https://www.mcmaster.com/90494A029/",
                    material: "Steel"
                },
                {
                    values: {
                        vendor: "MCMASTER",
                        size: "QUARTER_20",
                        type: "SQUARE"
                    },
                    name: "1/4-20 Square Nut",
                    vendor: "McMaster-Carr",
                    partNumber: "90043A029",
                    url: "https://www.mcmaster.com/90043A029/",
                    material: "Steel"
                }
            ]
        }
    }
};
