/* Synced from robot-education/robot-code@7674062a93d5de0f436b9b8a8fa20447c75a1a08 by `npm run sync:generated-parts` -- DO NOT EDIT */

export const CATALOG = {
    source: "featurescripts/fasteners/fastenerTables.py",
    vendors: [
        {
            id: "GENERIC",
            name: "Generic"
        },
        {
            id: "MCMASTER",
            name: "McMaster-Carr"
        },
        {
            id: "REV",
            name: "REV"
        },
        {
            id: "WCP",
            name: "WCP"
        },
        {
            id: "ANDYMARK",
            name: "AndyMark"
        }
    ],
    sizes: [
        {
            id: "NO_4_40",
            name: "#4-40",
            majorDiameter: 0.0028448,
            pitch: 0.000635,
            tapDrillDiameter: 0.0022606,
            closeClearanceDiameter: 0.0029464,
            freeClearanceDiameter: 0.0032639
        },
        {
            id: "NO_6_32",
            name: "#6-32",
            majorDiameter: 0.0035052,
            pitch: 0.00079375,
            tapDrillDiameter: 0.0027051,
            closeClearanceDiameter: 0.0036576,
            freeClearanceDiameter: 0.0037973
        },
        {
            id: "NO_8_32",
            name: "#8-32",
            majorDiameter: 0.0041656,
            pitch: 0.00079375,
            tapDrillDiameter: 0.0034544,
            closeClearanceDiameter: 0.0043053,
            freeClearanceDiameter: 0.0044958
        },
        {
            id: "NO_10_32",
            name: "#10-32",
            majorDiameter: 0.004826,
            pitch: 0.00079375,
            tapDrillDiameter: 0.0040386,
            closeClearanceDiameter: 0.0049784,
            freeClearanceDiameter: 0.0051054
        },
        {
            id: "QUARTER_20",
            name: "1/4-20",
            majorDiameter: 0.00635,
            pitch: 0.00127,
            tapDrillDiameter: 0.0051054,
            closeClearanceDiameter: 0.0065278,
            freeClearanceDiameter: 0.0067564
        }
    ],
    heads: [
        {
            id: "SOCKET",
            name: "Socket head",
            sizes: {
                NO_4_40: {
                    diameter: 0.0046482,
                    height: 0.0028448,
                    countersunk: false
                },
                NO_6_32: {
                    diameter: 0.0057404,
                    height: 0.0035052,
                    countersunk: false
                },
                NO_8_32: {
                    diameter: 0.006858,
                    height: 0.0041656,
                    countersunk: false
                },
                NO_10_32: {
                    diameter: 0.0079248,
                    height: 0.004826,
                    countersunk: false
                },
                QUARTER_20: {
                    diameter: 0.009525,
                    height: 0.00635,
                    countersunk: false
                }
            }
        },
        {
            id: "BUTTON",
            name: "Button head",
            sizes: {
                NO_4_40: {
                    diameter: 0.0054102,
                    height: 0.0014986,
                    countersunk: false
                },
                NO_6_32: {
                    diameter: 0.0066548,
                    height: 0.0018796,
                    countersunk: false
                },
                NO_8_32: {
                    diameter: 0.0079248,
                    height: 0.0022098,
                    countersunk: false
                },
                NO_10_32: {
                    diameter: 0.009525,
                    height: 0.0025908,
                    countersunk: false
                },
                QUARTER_20: {
                    diameter: 0.0110998,
                    height: 0.0033528,
                    countersunk: false
                }
            }
        },
        {
            id: "FLAT",
            name: "Flat head",
            sizes: {
                NO_4_40: {
                    diameter: 0.006477,
                    height: 0.0021082,
                    countersunk: true
                },
                NO_6_32: {
                    diameter: 0.0077978,
                    height: 0.0024638,
                    countersunk: true
                },
                NO_8_32: {
                    diameter: 0.0091186,
                    height: 0.002921,
                    countersunk: true
                },
                NO_10_32: {
                    diameter: 0.0104394,
                    height: 0.0033528,
                    countersunk: true
                },
                QUARTER_20: {
                    diameter: 0.0134874,
                    height: 0.0038862,
                    countersunk: true
                }
            }
        }
    ],
    screws: [
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_125",
                    name: "2-1/8 in.",
                    length: 0.053975,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651,
                    fullThreadChoice: false
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_75",
                    name: "4-3/4 in.",
                    length: 0.12065,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_375",
                    name: "2-3/8 in.",
                    length: 0.060325,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_625",
                    name: "2-5/8 in.",
                    length: 0.066675,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_25",
                    name: "4-1/4 in.",
                    length: 0.10795,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_25",
                    name: "5-1/4 in.",
                    length: 0.13335,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_75",
                    name: "5-3/4 in.",
                    length: 0.14605,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6_25",
                    name: "6-1/4 in.",
                    length: 0.15875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651,
                    fullThreadChoice: false
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778,
                    fullThreadChoice: false
                },
                {
                    id: "IN_7_5",
                    name: "7-1/2 in.",
                    length: 0.1905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_8",
                    name: "8 in.",
                    length: 0.2032,
                    fullThreadChoice: false
                },
                {
                    id: "IN_8_5",
                    name: "8-1/2 in.",
                    length: 0.2159,
                    fullThreadChoice: false
                },
                {
                    id: "IN_9",
                    name: "9 in.",
                    length: 0.2286,
                    fullThreadChoice: false
                },
                {
                    id: "IN_10",
                    name: "10 in.",
                    length: 0.254,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "SOCKET",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "BUTTON",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "FLAT",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "SOCKET",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "BUTTON",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "FLAT",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: true
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: true
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: true
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: true
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: true
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "SOCKET",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "BUTTON",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "FLAT",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: true
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: true
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: true
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: true
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: true
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: true
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: true
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651,
                    fullThreadChoice: false
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "SOCKET",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "FLAT",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_375",
                    name: "2-3/8 in.",
                    length: 0.060325,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_625",
                    name: "2-5/8 in.",
                    length: 0.066675,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_25",
                    name: "4-1/4 in.",
                    length: 0.10795,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_25",
                    name: "5-1/4 in.",
                    length: 0.13335,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_75",
                    name: "5-3/4 in.",
                    length: 0.14605,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6_25",
                    name: "6-1/4 in.",
                    length: 0.15875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651,
                    fullThreadChoice: false
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778,
                    fullThreadChoice: false
                },
                {
                    id: "IN_7_5",
                    name: "7-1/2 in.",
                    length: 0.1905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_8",
                    name: "8 in.",
                    length: 0.2032,
                    fullThreadChoice: false
                },
                {
                    id: "IN_8_5",
                    name: "8-1/2 in.",
                    length: 0.2159,
                    fullThreadChoice: false
                },
                {
                    id: "IN_9",
                    name: "9 in.",
                    length: 0.2286,
                    fullThreadChoice: false
                },
                {
                    id: "IN_10",
                    name: "10 in.",
                    length: 0.254,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "SOCKET",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "BUTTON",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "FLAT",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "REV",
            size: "NO_10_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "REV",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "REV",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "REV",
            size: "NO_10_32",
            head: "FLAT",
            finish: "ZINC_PLATED",
            lengths: [
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_4_40",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_6_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_8_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_8_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    fullThreadChoice: false
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_4_75",
                    name: "4-3/4 in.",
                    length: 0.12065,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "ALUMINUM",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_4_40",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_4_40",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_4_40",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_6_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_2_125",
                    name: "2-1/8 in.",
                    length: 0.053975,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_6_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_8_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_10_32",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_10_32",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "QUARTER_20",
            head: "SOCKET",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    fullThreadChoice: false
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "QUARTER_20",
            head: "BUTTON",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    fullThreadChoice: false
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    fullThreadChoice: false
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    fullThreadChoice: false
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "QUARTER_20",
            head: "FLAT",
            finish: "BLACK",
            lengths: [
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    fullThreadChoice: false
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    fullThreadChoice: false
                }
            ]
        }
    ],
    nutTypes: [
        {
            id: "NYLOCK",
            name: "Nylock"
        },
        {
            id: "THIN_NYLOCK",
            name: "Thin nylock"
        },
        {
            id: "HEX",
            name: "Hex"
        },
        {
            id: "THIN_HEX",
            name: "Thin hex"
        },
        {
            id: "SQUARE",
            name: "Square"
        }
    ],
    nuts: [
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            type: "NYLOCK",
            acrossFlats: 0.00635,
            height: 0.0035814
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            type: "THIN_NYLOCK",
            acrossFlats: 0.00635,
            height: 0.0027686
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            type: "HEX",
            acrossFlats: 0.00635,
            height: 0.0023876
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            type: "THIN_HEX",
            acrossFlats: 0.00635,
            height: 0.0016002
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            type: "NYLOCK",
            acrossFlats: 0.0079375,
            height: 0.0043688
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            type: "THIN_NYLOCK",
            acrossFlats: 0.0079375,
            height: 0.003175
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            type: "HEX",
            acrossFlats: 0.0079375,
            height: 0.0027686
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            type: "THIN_HEX",
            acrossFlats: 0.0079375,
            height: 0.0019812
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            type: "NYLOCK",
            acrossFlats: 0.00873125,
            height: 0.0051562
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            type: "THIN_NYLOCK",
            acrossFlats: 0.00873125,
            height: 0.0035814
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            type: "HEX",
            acrossFlats: 0.00873125,
            height: 0.003175
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            type: "SQUARE",
            acrossFlats: 0.00873125,
            height: 0.003175
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "NYLOCK",
            acrossFlats: 0.009525,
            height: 0.0059944
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "THIN_NYLOCK",
            acrossFlats: 0.009525,
            height: 0.0039624
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "HEX",
            acrossFlats: 0.009525,
            height: 0.003175
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "SQUARE",
            acrossFlats: 0.009525,
            height: 0.003175
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            type: "NYLOCK",
            acrossFlats: 0.0111125,
            height: 0.0079248
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            type: "THIN_NYLOCK",
            acrossFlats: 0.0111125,
            height: 0.0051562
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            type: "HEX",
            acrossFlats: 0.0111125,
            height: 0.0055626
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            type: "SQUARE",
            acrossFlats: 0.0111125,
            height: 0.0055626
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            type: "NYLOCK",
            acrossFlats: 0.00635,
            height: 0.0035814,
            partNumber: "90631A005",
            url: "https://www.mcmaster.com/90631A005/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            type: "THIN_NYLOCK",
            acrossFlats: 0.00635,
            height: 0.0027686,
            partNumber: "90633A005",
            url: "https://www.mcmaster.com/90633A005/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            type: "HEX",
            acrossFlats: 0.00635,
            height: 0.0023876,
            partNumber: "90480A005",
            url: "https://www.mcmaster.com/90480A005/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            type: "THIN_HEX",
            acrossFlats: 0.00635,
            height: 0.0016002,
            partNumber: "90760A005",
            url: "https://www.mcmaster.com/90760A005/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "NYLOCK",
            acrossFlats: 0.0079375,
            height: 0.0043688,
            partNumber: "90631A007"
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "THIN_NYLOCK",
            acrossFlats: 0.0079375,
            height: 0.003175,
            partNumber: "90633A007"
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "HEX",
            acrossFlats: 0.0079375,
            height: 0.0027686,
            partNumber: "90480A007"
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "THIN_HEX",
            acrossFlats: 0.0079375,
            height: 0.0019812,
            partNumber: "90760A007"
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            type: "NYLOCK",
            acrossFlats: 0.00873125,
            height: 0.0051562,
            partNumber: "90631A009",
            url: "https://www.mcmaster.com/90631A009/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            type: "THIN_NYLOCK",
            acrossFlats: 0.00873125,
            height: 0.0035814,
            partNumber: "90633A009",
            url: "https://www.mcmaster.com/90633A009/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            type: "HEX",
            acrossFlats: 0.00873125,
            height: 0.003175,
            partNumber: "90480A009",
            url: "https://www.mcmaster.com/90480A009/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            type: "SQUARE",
            acrossFlats: 0.00873125,
            height: 0.003175,
            partNumber: "94855A216",
            url: "https://www.mcmaster.com/94855A216/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "NYLOCK",
            acrossFlats: 0.009525,
            height: 0.0059944,
            partNumber: "90631A411",
            url: "https://www.mcmaster.com/90631A411/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "THIN_NYLOCK",
            acrossFlats: 0.009525,
            height: 0.0039624,
            partNumber: "90633A411",
            url: "https://www.mcmaster.com/90633A411/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "HEX",
            acrossFlats: 0.009525,
            height: 0.003175,
            partNumber: "90480A195",
            url: "https://www.mcmaster.com/90480A195/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "SQUARE",
            acrossFlats: 0.009525,
            height: 0.003175,
            partNumber: "94855A283",
            url: "https://www.mcmaster.com/94855A283/"
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            type: "NYLOCK",
            acrossFlats: 0.0111125,
            height: 0.0079248,
            partNumber: "90640A129",
            url: "https://www.mcmaster.com/90640A129/"
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            type: "THIN_NYLOCK",
            acrossFlats: 0.0111125,
            height: 0.0051562,
            partNumber: "90566A029",
            url: "https://www.mcmaster.com/90566A029/"
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            type: "HEX",
            acrossFlats: 0.0111125,
            height: 0.0055626,
            partNumber: "90494A029",
            url: "https://www.mcmaster.com/90494A029/"
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            type: "SQUARE",
            acrossFlats: 0.0111125,
            height: 0.0055626,
            partNumber: "90043A029",
            url: "https://www.mcmaster.com/90043A029/"
        }
    ],
    washers: [
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            type: "OD_5_16_X_0_032",
            name: "5/16 in. OD x 0.032 in.",
            innerDiameter: 0.003175,
            outerDiameter: 0.0079375,
            thickness: 0.0008128,
            finishes: ["BLACK"]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            type: "OD_3_8_X_0_049",
            name: "3/8 in. OD x 0.049 in.",
            innerDiameter: 0.0039624,
            outerDiameter: 0.009525,
            thickness: 0.0012446,
            finishes: ["BLACK"]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            type: "OD_7_16_X_0_049",
            name: "7/16 in. OD x 0.049 in.",
            innerDiameter: 0.0047752,
            outerDiameter: 0.0111125,
            thickness: 0.0012446,
            finishes: ["BLACK"]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "OD_1_2_X_0_049",
            name: "1/2 in. OD x 0.049 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.0127,
            thickness: 0.0012446,
            finishes: ["BLACK"]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            type: "OD_5_8_X_0_065",
            name: "5/8 in. OD x 0.065 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.015875,
            thickness: 0.001651,
            finishes: ["BLACK"]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            type: "OD_5_16_X_0_03",
            name: "5/16 in. OD x 0.03 in.",
            innerDiameter: 0.003175,
            outerDiameter: 0.0079375,
            thickness: 0.000762,
            finishes: ["BLACK", "STAINLESS"]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "OD_5_16_X_0_03",
            name: "5/16 in. OD x 0.03 in.",
            innerDiameter: 0.0039624,
            outerDiameter: 0.0079375,
            thickness: 0.000762,
            finishes: ["STAINLESS"]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "OD_3_8_X_0_03",
            name: "3/8 in. OD x 0.03 in.",
            innerDiameter: 0.0039624,
            outerDiameter: 0.009525,
            thickness: 0.000762,
            finishes: ["BLACK"]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            type: "OD_3_8_X_0_03",
            name: "3/8 in. OD x 0.03 in.",
            innerDiameter: 0.0047752,
            outerDiameter: 0.009525,
            thickness: 0.000762,
            finishes: ["BLACK", "STAINLESS"]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "OD_7_16_X_0_03",
            name: "7/16 in. OD x 0.03 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.0111125,
            thickness: 0.000762,
            finishes: ["BLACK", "STAINLESS"]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "OD_1_2_X_0_04",
            name: "1/2 in. OD x 0.04 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.0127,
            thickness: 0.001016,
            finishes: ["BLACK"]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            type: "OD_5_8_X_0_05",
            name: "5/8 in. OD x 0.05 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.015875,
            thickness: 0.00127,
            finishes: ["BLACK", "STAINLESS"]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            type: "OD_3_8_X_0_012",
            name: "3/8 in. OD x 0.012 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.009525,
            thickness: 0.0003048,
            finishes: ["BLACK"]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            type: "OD_3_8_X_0_031",
            name: "3/8 in. OD x 0.031 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.009525,
            thickness: 0.0007874,
            finishes: ["BLACK"]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            type: "OD_5_8_X_0_031",
            name: "5/8 in. OD x 0.031 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.015875,
            thickness: 0.0007874,
            finishes: ["BLACK"]
        },
        {
            vendor: "WCP",
            size: "QUARTER_20",
            type: "OD_3_8_X_0_012",
            name: "3/8 in. OD x 0.012 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.009525,
            thickness: 0.0003048,
            finishes: ["BLACK"]
        },
        {
            vendor: "WCP",
            size: "QUARTER_20",
            type: "OD_3_8_X_0_031",
            name: "3/8 in. OD x 0.031 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.009525,
            thickness: 0.0007874,
            finishes: ["BLACK"]
        }
    ]
};
