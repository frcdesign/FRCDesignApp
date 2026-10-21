/* Synced from robot-education/robot-code@a9be8cc067da34e800b212d3f9dff1a325acc2aa (featurescripts/fasteners/fasteners.gen.json) by `npm run sync:quick-fastener` -- DO NOT EDIT */

export const CATALOG_SOURCE =
    "robot-education/robot-code@a9be8cc067da34e800b212d3f9dff1a325acc2aa";

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
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_4_40",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_125",
                    name: "2-1/8 in.",
                    length: 0.053975
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_4_75",
                    name: "4-3/4 in.",
                    length: 0.12065
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_375",
                    name: "2-3/8 in.",
                    length: 0.060325
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_625",
                    name: "2-5/8 in.",
                    length: 0.066675
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                },
                {
                    id: "IN_4_25",
                    name: "4-1/4 in.",
                    length: 0.10795
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127
                },
                {
                    id: "IN_5_25",
                    name: "5-1/4 in.",
                    length: 0.13335
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397
                },
                {
                    id: "IN_5_75",
                    name: "5-3/4 in.",
                    length: 0.14605
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524
                },
                {
                    id: "IN_6_25",
                    name: "6-1/4 in.",
                    length: 0.15875
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778
                },
                {
                    id: "IN_7_5",
                    name: "7-1/2 in.",
                    length: 0.1905
                },
                {
                    id: "IN_8",
                    name: "8 in.",
                    length: 0.2032
                },
                {
                    id: "IN_8_5",
                    name: "8-1/2 in.",
                    length: 0.2159
                },
                {
                    id: "IN_9",
                    name: "9 in.",
                    length: 0.2286
                },
                {
                    id: "IN_10",
                    name: "10 in.",
                    length: 0.254
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                }
            ]
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    partNumber: "91251A231",
                    url: "https://www.mcmaster.com/91251A231/"
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91864A018",
                    url: "https://www.mcmaster.com/91864A018/"
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "91251A232",
                    url: "https://www.mcmaster.com/91251A232/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91251A105",
                    url: "https://www.mcmaster.com/91251A105/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91251A106",
                    url: "https://www.mcmaster.com/91251A106/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91251A107",
                    url: "https://www.mcmaster.com/91251A107/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91251A108",
                    url: "https://www.mcmaster.com/91251A108/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91864A081",
                    url: "https://www.mcmaster.com/91864A081/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91251A110",
                    url: "https://www.mcmaster.com/91251A110/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91864A028",
                    url: "https://www.mcmaster.com/91864A028/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91251A112",
                    url: "https://www.mcmaster.com/91251A112/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91251A113",
                    url: "https://www.mcmaster.com/91251A113/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91251A114",
                    url: "https://www.mcmaster.com/91251A114/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91251A115",
                    url: "https://www.mcmaster.com/91251A115/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91864A029",
                    url: "https://www.mcmaster.com/91864A029/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91251A078",
                    url: "https://www.mcmaster.com/91251A078/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91251A210",
                    url: "https://www.mcmaster.com/91251A210/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91251A149",
                    url: "https://www.mcmaster.com/91251A149/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91251A233",
                    url: "https://www.mcmaster.com/91251A233/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91251A160",
                    url: "https://www.mcmaster.com/91251A160/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91251A162",
                    url: "https://www.mcmaster.com/91251A162/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91251A211",
                    url: "https://www.mcmaster.com/91251A211/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91251A834",
                    url: "https://www.mcmaster.com/91251A834/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "91251A513",
                    url: "https://www.mcmaster.com/91251A513/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91251A212",
                    url: "https://www.mcmaster.com/91251A212/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "90044A291",
                    url: "https://www.mcmaster.com/90044A291/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "90044A292",
                    url: "https://www.mcmaster.com/90044A292/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91255A103",
                    url: "https://www.mcmaster.com/91255A103/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91255A105",
                    url: "https://www.mcmaster.com/91255A105/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91255A106",
                    url: "https://www.mcmaster.com/91255A106/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91255A107",
                    url: "https://www.mcmaster.com/91255A107/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91255A108",
                    url: "https://www.mcmaster.com/91255A108/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91255A021",
                    url: "https://www.mcmaster.com/91255A021/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91255A110",
                    url: "https://www.mcmaster.com/91255A110/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91255A022",
                    url: "https://www.mcmaster.com/91255A022/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91255A112",
                    url: "https://www.mcmaster.com/91255A112/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91255A113",
                    url: "https://www.mcmaster.com/91255A113/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91255A115",
                    url: "https://www.mcmaster.com/91255A115/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91255A116",
                    url: "https://www.mcmaster.com/91255A116/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91255A117",
                    url: "https://www.mcmaster.com/91255A117/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91255A023",
                    url: "https://www.mcmaster.com/91255A023/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91255A118",
                    url: "https://www.mcmaster.com/91255A118/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91263A375",
                    url: "https://www.mcmaster.com/91263A375/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91263A376",
                    url: "https://www.mcmaster.com/91263A376/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91263A136",
                    url: "https://www.mcmaster.com/91263A136/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91263A501",
                    url: "https://www.mcmaster.com/91263A501/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91263A503",
                    url: "https://www.mcmaster.com/91263A503/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91263A961",
                    url: "https://www.mcmaster.com/91263A961/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91263A962",
                    url: "https://www.mcmaster.com/91263A962/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    partNumber: "91251A268",
                    url: "https://www.mcmaster.com/91251A268/"
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91864A084",
                    url: "https://www.mcmaster.com/91864A084/"
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "91251A269",
                    url: "https://www.mcmaster.com/91251A269/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91864A085",
                    url: "https://www.mcmaster.com/91864A085/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91251A144",
                    url: "https://www.mcmaster.com/91251A144/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91864A019",
                    url: "https://www.mcmaster.com/91864A019/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91251A146",
                    url: "https://www.mcmaster.com/91251A146/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91864A023",
                    url: "https://www.mcmaster.com/91864A023/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91251A148",
                    url: "https://www.mcmaster.com/91251A148/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91864A086",
                    url: "https://www.mcmaster.com/91864A086/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91251A150",
                    url: "https://www.mcmaster.com/91251A150/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91251A151",
                    url: "https://www.mcmaster.com/91251A151/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91251A152",
                    url: "https://www.mcmaster.com/91251A152/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91251A153",
                    url: "https://www.mcmaster.com/91251A153/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91251A870",
                    url: "https://www.mcmaster.com/91251A870/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91251A155",
                    url: "https://www.mcmaster.com/91251A155/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91251A874",
                    url: "https://www.mcmaster.com/91251A874/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91251A157",
                    url: "https://www.mcmaster.com/91251A157/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91251A875",
                    url: "https://www.mcmaster.com/91251A875/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91251A158",
                    url: "https://www.mcmaster.com/91251A158/"
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    partNumber: "91251A270",
                    url: "https://www.mcmaster.com/91251A270/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91251A159",
                    url: "https://www.mcmaster.com/91251A159/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91251A876",
                    url: "https://www.mcmaster.com/91251A876/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91251A871",
                    url: "https://www.mcmaster.com/91251A871/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "91251A872",
                    url: "https://www.mcmaster.com/91251A872/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91251A873",
                    url: "https://www.mcmaster.com/91251A873/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "90044A295",
                    url: "https://www.mcmaster.com/90044A295/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91255A140",
                    url: "https://www.mcmaster.com/91255A140/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91255A142",
                    url: "https://www.mcmaster.com/91255A142/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91255A144",
                    url: "https://www.mcmaster.com/91255A144/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91255A145",
                    url: "https://www.mcmaster.com/91255A145/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91255A146",
                    url: "https://www.mcmaster.com/91255A146/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91255A133",
                    url: "https://www.mcmaster.com/91255A133/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91255A148",
                    url: "https://www.mcmaster.com/91255A148/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91255A134",
                    url: "https://www.mcmaster.com/91255A134/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91255A150",
                    url: "https://www.mcmaster.com/91255A150/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91255A151",
                    url: "https://www.mcmaster.com/91255A151/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91255A152",
                    url: "https://www.mcmaster.com/91255A152/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91255A153",
                    url: "https://www.mcmaster.com/91255A153/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91255A135",
                    url: "https://www.mcmaster.com/91255A135/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91255A155",
                    url: "https://www.mcmaster.com/91255A155/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91263A505",
                    url: "https://www.mcmaster.com/91263A505/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91263A512",
                    url: "https://www.mcmaster.com/91263A512/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91263A506",
                    url: "https://www.mcmaster.com/91263A506/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91263A514",
                    url: "https://www.mcmaster.com/91263A514/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91263A516",
                    url: "https://www.mcmaster.com/91263A516/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91263A507",
                    url: "https://www.mcmaster.com/91263A507/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91263A518",
                    url: "https://www.mcmaster.com/91263A518/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91263A520",
                    url: "https://www.mcmaster.com/91263A520/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_09375",
                    name: "3/32 in.",
                    length: 0.00238125,
                    partNumber: "91251A271",
                    url: "https://www.mcmaster.com/91251A271/"
                },
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91251A179",
                    url: "https://www.mcmaster.com/91251A179/"
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "91251A272",
                    url: "https://www.mcmaster.com/91251A272/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91251A180",
                    url: "https://www.mcmaster.com/91251A180/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91251A190",
                    url: "https://www.mcmaster.com/91251A190/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91251A191",
                    url: "https://www.mcmaster.com/91251A191/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91251A192",
                    url: "https://www.mcmaster.com/91251A192/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91864A024",
                    url: "https://www.mcmaster.com/91864A024/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91251A194",
                    url: "https://www.mcmaster.com/91251A194/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91864A033",
                    url: "https://www.mcmaster.com/91864A033/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91251A196",
                    url: "https://www.mcmaster.com/91251A196/"
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    partNumber: "90044A421",
                    url: "https://www.mcmaster.com/90044A421/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91251A197",
                    url: "https://www.mcmaster.com/91251A197/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91251A198",
                    url: "https://www.mcmaster.com/91251A198/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91251A199",
                    url: "https://www.mcmaster.com/91251A199/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91864A025",
                    url: "https://www.mcmaster.com/91864A025/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91251A201",
                    url: "https://www.mcmaster.com/91251A201/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91864A026",
                    url: "https://www.mcmaster.com/91864A026/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91251A203",
                    url: "https://www.mcmaster.com/91251A203/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91864A027",
                    url: "https://www.mcmaster.com/91864A027/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91251A082",
                    url: "https://www.mcmaster.com/91251A082/"
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    partNumber: "91251A188",
                    url: "https://www.mcmaster.com/91251A188/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91251A205",
                    url: "https://www.mcmaster.com/91251A205/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91251A184",
                    url: "https://www.mcmaster.com/91251A184/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91251A207",
                    url: "https://www.mcmaster.com/91251A207/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "91251A827",
                    url: "https://www.mcmaster.com/91251A827/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91251A086",
                    url: "https://www.mcmaster.com/91251A086/"
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    partNumber: "91251A189",
                    url: "https://www.mcmaster.com/91251A189/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "91251A186",
                    url: "https://www.mcmaster.com/91251A186/"
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    partNumber: "91251A285",
                    url: "https://www.mcmaster.com/91251A285/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "91251A193",
                    url: "https://www.mcmaster.com/91251A193/"
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    partNumber: "90044A297",
                    url: "https://www.mcmaster.com/90044A297/"
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    partNumber: "90044A298",
                    url: "https://www.mcmaster.com/90044A298/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91255A162",
                    url: "https://www.mcmaster.com/91255A162/"
                },
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "91255A163",
                    url: "https://www.mcmaster.com/91255A163/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91255A189",
                    url: "https://www.mcmaster.com/91255A189/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91255A190",
                    url: "https://www.mcmaster.com/91255A190/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91255A191",
                    url: "https://www.mcmaster.com/91255A191/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91255A192",
                    url: "https://www.mcmaster.com/91255A192/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91255A164",
                    url: "https://www.mcmaster.com/91255A164/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91255A194",
                    url: "https://www.mcmaster.com/91255A194/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91255A165",
                    url: "https://www.mcmaster.com/91255A165/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91255A196",
                    url: "https://www.mcmaster.com/91255A196/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91255A197",
                    url: "https://www.mcmaster.com/91255A197/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91255A166",
                    url: "https://www.mcmaster.com/91255A166/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91255A199",
                    url: "https://www.mcmaster.com/91255A199/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91255A167",
                    url: "https://www.mcmaster.com/91255A167/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91255A201",
                    url: "https://www.mcmaster.com/91255A201/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91255A168",
                    url: "https://www.mcmaster.com/91255A168/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91255A203",
                    url: "https://www.mcmaster.com/91255A203/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91255A169",
                    url: "https://www.mcmaster.com/91255A169/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91255A205",
                    url: "https://www.mcmaster.com/91255A205/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91255A206",
                    url: "https://www.mcmaster.com/91255A206/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91255A811",
                    url: "https://www.mcmaster.com/91255A811/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91255A812",
                    url: "https://www.mcmaster.com/91255A812/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91263A521",
                    url: "https://www.mcmaster.com/91263A521/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91263A523",
                    url: "https://www.mcmaster.com/91263A523/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91263A522",
                    url: "https://www.mcmaster.com/91263A522/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91263A524",
                    url: "https://www.mcmaster.com/91263A524/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91263A525",
                    url: "https://www.mcmaster.com/91263A525/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91263A526",
                    url: "https://www.mcmaster.com/91263A526/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91263A527",
                    url: "https://www.mcmaster.com/91263A527/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91263A528",
                    url: "https://www.mcmaster.com/91263A528/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91263A142",
                    url: "https://www.mcmaster.com/91263A142/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91263A145",
                    url: "https://www.mcmaster.com/91263A145/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_15625",
                    name: "5/32 in.",
                    length: 0.00396875,
                    partNumber: "91251A518",
                    url: "https://www.mcmaster.com/91251A518/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91251A901",
                    url: "https://www.mcmaster.com/91251A901/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91251A338",
                    url: "https://www.mcmaster.com/91251A338/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91251A337",
                    url: "https://www.mcmaster.com/91251A337/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91251A340",
                    url: "https://www.mcmaster.com/91251A340/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91251A350",
                    url: "https://www.mcmaster.com/91251A350/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91251A342",
                    url: "https://www.mcmaster.com/91251A342/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91251A356",
                    url: "https://www.mcmaster.com/91251A356/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91251A344",
                    url: "https://www.mcmaster.com/91251A344/"
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    partNumber: "90044A201",
                    url: "https://www.mcmaster.com/90044A201/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91251A345",
                    url: "https://www.mcmaster.com/91251A345/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91251A346",
                    url: "https://www.mcmaster.com/91251A346/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91251A347",
                    url: "https://www.mcmaster.com/91251A347/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91251A348",
                    url: "https://www.mcmaster.com/91251A348/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91251A349",
                    url: "https://www.mcmaster.com/91251A349/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "90044A202",
                    url: "https://www.mcmaster.com/90044A202/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91251A351",
                    url: "https://www.mcmaster.com/91251A351/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91251A287",
                    url: "https://www.mcmaster.com/91251A287/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91251A352",
                    url: "https://www.mcmaster.com/91251A352/"
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    partNumber: "91251A288",
                    url: "https://www.mcmaster.com/91251A288/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91251A353",
                    url: "https://www.mcmaster.com/91251A353/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91251A354",
                    url: "https://www.mcmaster.com/91251A354/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91251A355",
                    url: "https://www.mcmaster.com/91251A355/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "91251A359",
                    url: "https://www.mcmaster.com/91251A359/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91251A360",
                    url: "https://www.mcmaster.com/91251A360/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "91251A361",
                    url: "https://www.mcmaster.com/91251A361/"
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    partNumber: "91251A289",
                    url: "https://www.mcmaster.com/91251A289/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "91251A364",
                    url: "https://www.mcmaster.com/91251A364/"
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    partNumber: "91251A357",
                    url: "https://www.mcmaster.com/91251A357/"
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    partNumber: "91251A358",
                    url: "https://www.mcmaster.com/91251A358/"
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    partNumber: "91251A906",
                    url: "https://www.mcmaster.com/91251A906/"
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    partNumber: "91251A907",
                    url: "https://www.mcmaster.com/91251A907/"
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651,
                    partNumber: "90044A262",
                    url: "https://www.mcmaster.com/90044A262/"
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778,
                    partNumber: "90044A263",
                    url: "https://www.mcmaster.com/90044A263/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_125",
                    name: "1/8 in.",
                    length: 0.003175,
                    partNumber: "91255A024",
                    url: "https://www.mcmaster.com/91255A024/"
                },
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91255A025",
                    url: "https://www.mcmaster.com/91255A025/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91255A261",
                    url: "https://www.mcmaster.com/91255A261/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91255A262",
                    url: "https://www.mcmaster.com/91255A262/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91255A263",
                    url: "https://www.mcmaster.com/91255A263/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91255A026",
                    url: "https://www.mcmaster.com/91255A026/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91255A265",
                    url: "https://www.mcmaster.com/91255A265/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91255A027",
                    url: "https://www.mcmaster.com/91255A027/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91255A267",
                    url: "https://www.mcmaster.com/91255A267/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91255A269",
                    url: "https://www.mcmaster.com/91255A269/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91255A271",
                    url: "https://www.mcmaster.com/91255A271/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91255A273",
                    url: "https://www.mcmaster.com/91255A273/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91255A028",
                    url: "https://www.mcmaster.com/91255A028/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91255A274",
                    url: "https://www.mcmaster.com/91255A274/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91255A272",
                    url: "https://www.mcmaster.com/91255A272/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91255A275",
                    url: "https://www.mcmaster.com/91255A275/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91255A277",
                    url: "https://www.mcmaster.com/91255A277/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91255A276",
                    url: "https://www.mcmaster.com/91255A276/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91255A278",
                    url: "https://www.mcmaster.com/91255A278/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91255A815",
                    url: "https://www.mcmaster.com/91255A815/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91255A029",
                    url: "https://www.mcmaster.com/91255A029/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91255A030",
                    url: "https://www.mcmaster.com/91255A030/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91263A540",
                    url: "https://www.mcmaster.com/91263A540/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91263A157",
                    url: "https://www.mcmaster.com/91263A157/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91263A542",
                    url: "https://www.mcmaster.com/91263A542/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91263A544",
                    url: "https://www.mcmaster.com/91263A544/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91263A543",
                    url: "https://www.mcmaster.com/91263A543/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91263A546",
                    url: "https://www.mcmaster.com/91263A546/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91263A547",
                    url: "https://www.mcmaster.com/91263A547/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91263A548",
                    url: "https://www.mcmaster.com/91263A548/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91263A160",
                    url: "https://www.mcmaster.com/91263A160/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91263A550",
                    url: "https://www.mcmaster.com/91263A550/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91263A163",
                    url: "https://www.mcmaster.com/91263A163/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91251A533",
                    url: "https://www.mcmaster.com/91251A533/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91864A061",
                    url: "https://www.mcmaster.com/91864A061/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91251A535",
                    url: "https://www.mcmaster.com/91251A535/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91864A062",
                    url: "https://www.mcmaster.com/91864A062/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91251A537",
                    url: "https://www.mcmaster.com/91251A537/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91251A538",
                    url: "https://www.mcmaster.com/91251A538/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91251A539",
                    url: "https://www.mcmaster.com/91251A539/"
                },
                {
                    id: "IN_0_6875",
                    name: "11/16 in.",
                    length: 0.0174625,
                    partNumber: "90044A423",
                    url: "https://www.mcmaster.com/90044A423/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91251A540",
                    url: "https://www.mcmaster.com/91251A540/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91251A541",
                    url: "https://www.mcmaster.com/91251A541/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91251A542",
                    url: "https://www.mcmaster.com/91251A542/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91251A560",
                    url: "https://www.mcmaster.com/91251A560/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91251A544",
                    url: "https://www.mcmaster.com/91251A544/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91251A543",
                    url: "https://www.mcmaster.com/91251A543/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "90044A123",
                    url: "https://www.mcmaster.com/90044A123/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91251A527",
                    url: "https://www.mcmaster.com/91251A527/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "90044A124",
                    url: "https://www.mcmaster.com/90044A124/"
                },
                {
                    id: "IN_1_875",
                    name: "1-7/8 in.",
                    length: 0.047625,
                    partNumber: "91251A548",
                    url: "https://www.mcmaster.com/91251A548/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "90044A125",
                    url: "https://www.mcmaster.com/90044A125/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "90044A126",
                    url: "https://www.mcmaster.com/90044A126/"
                },
                {
                    id: "IN_2_375",
                    name: "2-3/8 in.",
                    length: 0.060325,
                    partNumber: "90044A425",
                    url: "https://www.mcmaster.com/90044A425/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "90044A127",
                    url: "https://www.mcmaster.com/90044A127/"
                },
                {
                    id: "IN_2_625",
                    name: "2-5/8 in.",
                    length: 0.066675,
                    partNumber: "90044A426",
                    url: "https://www.mcmaster.com/90044A426/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "90044A128",
                    url: "https://www.mcmaster.com/90044A128/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "90044A129",
                    url: "https://www.mcmaster.com/90044A129/"
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    partNumber: "90044A526",
                    url: "https://www.mcmaster.com/90044A526/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "90044A316",
                    url: "https://www.mcmaster.com/90044A316/"
                },
                {
                    id: "IN_3_75",
                    name: "3-3/4 in.",
                    length: 0.09525,
                    partNumber: "90044A527",
                    url: "https://www.mcmaster.com/90044A527/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "90044A131",
                    url: "https://www.mcmaster.com/90044A131/"
                },
                {
                    id: "IN_4_25",
                    name: "4-1/4 in.",
                    length: 0.10795,
                    partNumber: "91251A559",
                    url: "https://www.mcmaster.com/91251A559/"
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    partNumber: "91251A089",
                    url: "https://www.mcmaster.com/91251A089/"
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    partNumber: "91251A090",
                    url: "https://www.mcmaster.com/91251A090/"
                },
                {
                    id: "IN_5_25",
                    name: "5-1/4 in.",
                    length: 0.13335,
                    partNumber: "91251A293",
                    url: "https://www.mcmaster.com/91251A293/"
                },
                {
                    id: "IN_5_5",
                    name: "5-1/2 in.",
                    length: 0.1397,
                    partNumber: "91251A093",
                    url: "https://www.mcmaster.com/91251A093/"
                },
                {
                    id: "IN_5_75",
                    name: "5-3/4 in.",
                    length: 0.14605,
                    partNumber: "91251A294",
                    url: "https://www.mcmaster.com/91251A294/"
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    partNumber: "91251A095",
                    url: "https://www.mcmaster.com/91251A095/"
                },
                {
                    id: "IN_6_25",
                    name: "6-1/4 in.",
                    length: 0.15875,
                    partNumber: "91251A562",
                    url: "https://www.mcmaster.com/91251A562/"
                },
                {
                    id: "IN_6_5",
                    name: "6-1/2 in.",
                    length: 0.1651,
                    partNumber: "91251A563",
                    url: "https://www.mcmaster.com/91251A563/"
                },
                {
                    id: "IN_7",
                    name: "7 in.",
                    length: 0.1778,
                    partNumber: "91251A908",
                    url: "https://www.mcmaster.com/91251A908/"
                },
                {
                    id: "IN_7_5",
                    name: "7-1/2 in.",
                    length: 0.1905,
                    partNumber: "91251A923",
                    url: "https://www.mcmaster.com/91251A923/"
                },
                {
                    id: "IN_8",
                    name: "8 in.",
                    length: 0.2032,
                    partNumber: "91251A566",
                    url: "https://www.mcmaster.com/91251A566/"
                },
                {
                    id: "IN_8_5",
                    name: "8-1/2 in.",
                    length: 0.2159,
                    partNumber: "90044A299",
                    url: "https://www.mcmaster.com/90044A299/"
                },
                {
                    id: "IN_9",
                    name: "9 in.",
                    length: 0.2286,
                    partNumber: "90044A311",
                    url: "https://www.mcmaster.com/90044A311/"
                },
                {
                    id: "IN_10",
                    name: "10 in.",
                    length: 0.254,
                    partNumber: "90044A312",
                    url: "https://www.mcmaster.com/90044A312/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_1875",
                    name: "3/16 in.",
                    length: 0.0047625,
                    partNumber: "91255A521",
                    url: "https://www.mcmaster.com/91255A521/"
                },
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "91255A533",
                    url: "https://www.mcmaster.com/91255A533/"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "91255A522",
                    url: "https://www.mcmaster.com/91255A522/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91255A535",
                    url: "https://www.mcmaster.com/91255A535/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "91255A523",
                    url: "https://www.mcmaster.com/91255A523/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91255A537",
                    url: "https://www.mcmaster.com/91255A537/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "91255A524",
                    url: "https://www.mcmaster.com/91255A524/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91255A539",
                    url: "https://www.mcmaster.com/91255A539/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91255A540",
                    url: "https://www.mcmaster.com/91255A540/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91255A541",
                    url: "https://www.mcmaster.com/91255A541/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91255A542",
                    url: "https://www.mcmaster.com/91255A542/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91255A525",
                    url: "https://www.mcmaster.com/91255A525/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91255A544",
                    url: "https://www.mcmaster.com/91255A544/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "91255A526",
                    url: "https://www.mcmaster.com/91255A526/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91255A546",
                    url: "https://www.mcmaster.com/91255A546/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "91255A527",
                    url: "https://www.mcmaster.com/91255A527/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91255A548",
                    url: "https://www.mcmaster.com/91255A548/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91255A545",
                    url: "https://www.mcmaster.com/91255A545/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91255A528",
                    url: "https://www.mcmaster.com/91255A528/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91255A547",
                    url: "https://www.mcmaster.com/91255A547/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "91255A529",
                    url: "https://www.mcmaster.com/91255A529/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91255A549",
                    url: "https://www.mcmaster.com/91255A549/"
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    partNumber: "91255A819",
                    url: "https://www.mcmaster.com/91255A819/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "91255A531",
                    url: "https://www.mcmaster.com/91255A531/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "91255A532",
                    url: "https://www.mcmaster.com/91255A532/"
                }
            ]
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "91263A551",
                    url: "https://www.mcmaster.com/91263A551/"
                },
                {
                    id: "IN_0_4375",
                    name: "7/16 in.",
                    length: 0.0111125,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "91263A553",
                    url: "https://www.mcmaster.com/91263A553/"
                },
                {
                    id: "IN_0_5625",
                    name: "9/16 in.",
                    length: 0.0142875,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "91263A556",
                    url: "https://www.mcmaster.com/91263A556/"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "91263A559",
                    url: "https://www.mcmaster.com/91263A559/"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "91263A560",
                    url: "https://www.mcmaster.com/91263A560/"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "91263A562",
                    url: "https://www.mcmaster.com/91263A562/"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "91263A166",
                    url: "https://www.mcmaster.com/91263A166/"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "91263A563",
                    url: "https://www.mcmaster.com/91263A563/"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "91263A564",
                    url: "https://www.mcmaster.com/91263A564/"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "91263A565",
                    url: "https://www.mcmaster.com/91263A565/"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "91263A566",
                    url: "https://www.mcmaster.com/91263A566/"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "91263A567",
                    url: "https://www.mcmaster.com/91263A567/"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "91263A568",
                    url: "https://www.mcmaster.com/91263A568/"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "91263A569",
                    url: "https://www.mcmaster.com/91263A569/"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "91263A570",
                    url: "https://www.mcmaster.com/91263A570/"
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "91263A169",
                    url: "https://www.mcmaster.com/91263A169/"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "91263A172",
                    url: "https://www.mcmaster.com/91263A172/"
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                },
                {
                    id: "IN_6",
                    name: "6 in.",
                    length: 0.1524,
                    partNumber: "null",
                    url: "https://www.mcmaster.com/null/"
                }
            ]
        },
        {
            vendor: "REV",
            size: "NO_10_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "REV-29-2910-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2910-PK50&section=product"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "REV-29-2911-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2911-PK50&section=product"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "REV-29-2912-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2912-PK50&section=product"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "REV-29-2914-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2914-PK50&section=product"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "REV-29-2916-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2916-PK50&section=product"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "REV-29-2918-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2918-PK50&section=product"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "REV-29-2922-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2922-PK50&section=product"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "REV-29-2924-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2924-PK50&section=product"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "REV-29-2926-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2926-PK50&section=product"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "REV-29-2928-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2928-PK25&section=product"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "REV-29-2930-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2930-PK25&section=product"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "REV-29-2931-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2931-PK25&section=product"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "REV-29-2932-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2932-PK25&section=product"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "REV-29-2933-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2933-PK25&section=product"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "REV-29-2934-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2934-PK25&section=product"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "REV-29-2936-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2936-PK25&section=product"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "REV-29-2938-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2938-PK25&section=product"
                }
            ]
        },
        {
            vendor: "REV",
            size: "NO_10_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "REV-29-2939-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2939-PK50&section=product"
                },
                {
                    id: "IN_0_3125",
                    name: "5/16 in.",
                    length: 0.0079375,
                    partNumber: "REV-29-2940-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2940-PK50&section=product"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "REV-29-2941-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2941-PK50&section=product"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "REV-29-2943-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2943-PK50&section=product"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "REV-29-2945-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2945-PK50&section=product"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "REV-29-2947-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2947-PK50&section=product"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "REV-29-2951-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2951-PK50&section=product"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "REV-29-2953-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2953-PK50&section=product"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "REV-29-2955-PK50",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2955-PK50&section=product"
                },
                {
                    id: "IN_1_625",
                    name: "1-5/8 in.",
                    length: 0.041275,
                    partNumber: "REV-29-2956-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2956-PK25&section=product"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "REV-29-2957-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2957-PK25&section=product"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "REV-29-2959-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2959-PK25&section=product"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "REV-29-2960-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2960-PK25&section=product"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "REV-29-2961-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2961-PK25&section=product"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "REV-29-2962-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2962-PK25&section=product"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "REV-29-2963-PK25",
                    url: "https://www.revrobotics.com/search.php?search_query=REV-29-2963-PK25&section=product"
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_4_40",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "WCP-2354",
                    url: "https://wcproducts.com/products/wcp-2354"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "WCP-2355",
                    url: "https://wcproducts.com/products/wcp-2355"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "WCP-2356",
                    url: "https://wcproducts.com/products/wcp-2356"
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_6_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "WCP-2353",
                    url: "https://wcproducts.com/products/wcp-2353"
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_8_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "WCP-2249",
                    url: "https://wcproducts.com/products/wcp-2249"
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_8_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "WCP-1548",
                    url: "https://wcproducts.com/products/wcp-1548"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "WCP-0250",
                    url: "https://wcproducts.com/products/wcp-0250"
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "WCP-0264",
                    url: "https://wcproducts.com/products/wcp-0264"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "WCP-0265",
                    url: "https://wcproducts.com/products/wcp-0265"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "WCP-0266",
                    url: "https://wcproducts.com/products/wcp-0266"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "WCP-0267",
                    url: "https://wcproducts.com/products/wcp-0267"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "WCP-0268",
                    url: "https://wcproducts.com/products/wcp-0268"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "WCP-1549",
                    url: "https://wcproducts.com/products/wcp-1549"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "WCP-0269",
                    url: "https://wcproducts.com/products/wcp-0269"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "WCP-0270",
                    url: "https://wcproducts.com/products/wcp-0270"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "WCP-0271",
                    url: "https://wcproducts.com/products/wcp-0271"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "WCP-0272",
                    url: "https://wcproducts.com/products/wcp-0272"
                },
                {
                    id: "IN_4",
                    name: "4 in.",
                    length: 0.1016,
                    partNumber: "WCP-0273",
                    url: "https://wcproducts.com/products/wcp-0273"
                },
                {
                    id: "IN_4_5",
                    name: "4-1/2 in.",
                    length: 0.1143,
                    partNumber: "WCP-0274",
                    url: "https://wcproducts.com/products/wcp-0274"
                },
                {
                    id: "IN_5",
                    name: "5 in.",
                    length: 0.127,
                    partNumber: "WCP-0275",
                    url: "https://wcproducts.com/products/wcp-0275"
                }
            ]
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "WCP-0251",
                    url: "https://wcproducts.com/products/wcp-0251"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "WCP-0252",
                    url: "https://wcproducts.com/products/wcp-0252"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "WCP-0253",
                    url: "https://wcproducts.com/products/wcp-0253"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "WCP-0135",
                    url: "https://wcproducts.com/products/wcp-0135"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "WCP-1463",
                    url: "https://wcproducts.com/products/wcp-1463"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "WCP-0255",
                    url: "https://wcproducts.com/products/wcp-0255"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "WCP-0256",
                    url: "https://wcproducts.com/products/wcp-0256"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "WCP-0257",
                    url: "https://wcproducts.com/products/wcp-0257"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "WCP-0258",
                    url: "https://wcproducts.com/products/wcp-0258"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "WCP-0259",
                    url: "https://wcproducts.com/products/wcp-0259"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "WCP-0260",
                    url: "https://wcproducts.com/products/wcp-0260"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "WCP-0261",
                    url: "https://wcproducts.com/products/wcp-0261"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "WCP-0262",
                    url: "https://wcproducts.com/products/wcp-0262"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "WCP-0263",
                    url: "https://wcproducts.com/products/wcp-0263"
                },
                {
                    id: "IN_4_75",
                    name: "4-3/4 in.",
                    length: 0.12065,
                    partNumber: "WCP-1656",
                    url: "https://wcproducts.com/products/wcp-1656"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_4_40",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "am-1032",
                    url: "https://andymark.com/products/4-40-x-0-375-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "am-1136",
                    url: "https://andymark.com/products/4-40-x-0-5-in-socket-head-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_4_40",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "am-1679",
                    url: "https://andymark.com/products/4-40-x-0-25-in-button-head-cap-screw-with-nylon-patch"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_4_40",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "am-1586",
                    url: "https://andymark.com/products/4-40-x-0-375-in-flat-head-cap-screw-with-nylon-patch"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_6_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_2_125",
                    name: "2-1/8 in.",
                    length: 0.053975,
                    partNumber: "am-1657",
                    url: "https://andymark.com/products/6-32-x-2-125-in-socket-head-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_6_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "am-1570",
                    url: "https://andymark.com/products/6-32-x-0-625-in-flat-head-socket-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_8_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "am-1691",
                    url: "https://andymark.com/products/8-32-x-0-5-in-button-head-cap-screw-with-nylon-patch"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_10_32",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_25",
                    name: "1/4 in.",
                    length: 0.00635,
                    partNumber: "am-1771",
                    url: "https://andymark.com/products/10-32-x-250-in-socket-head-cap-screw-with-nylon-thread-lock-patch"
                },
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "am-1359",
                    url: "https://andymark.com/products/10-32-x-0-375-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "am-1002",
                    url: "https://andymark.com/products/10-32-x-0-5-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "am-1007",
                    url: "https://andymark.com/products/10-32-x-0-625-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "am-1047",
                    url: "https://andymark.com/products/10-32-x-0-75-in-socket-head-cap-screw"
                },
                {
                    id: "IN_0_875",
                    name: "7/8 in.",
                    length: 0.022225,
                    partNumber: "am-1753",
                    url: "https://andymark.com/products/10-32-x-0-875-in-socket-head-cap-screw"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "am-1056",
                    url: "https://andymark.com/products/10-32-x-1-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_1_125",
                    name: "1-1/8 in.",
                    length: 0.028575,
                    partNumber: "am-1013",
                    url: "https://andymark.com/products/10-32-x-1-125-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "am-1041",
                    url: "https://andymark.com/products/10-32-x-1-25-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_1_375",
                    name: "1-3/8 in.",
                    length: 0.034925,
                    partNumber: "am-1154",
                    url: "https://andymark.com/products/10-32-x-1-375-in-socket-head-cap-screw"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "am-1014",
                    url: "https://andymark.com/products/10-32-x-1-5-in-socket-head-cap-screw"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "am-1048",
                    url: "https://andymark.com/products/10-32-x-1-75-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "am-1049",
                    url: "https://andymark.com/products/10-32-x-2-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_2_25",
                    name: "2-1/4 in.",
                    length: 0.05715,
                    partNumber: "am-1156",
                    url: "https://andymark.com/products/10-32-x-2-25-in-socket-head-cap-screw-2"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "am-1024",
                    url: "https://andymark.com/products/10-32-x-2-5-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_2_75",
                    name: "2-3/4 in.",
                    length: 0.06985,
                    partNumber: "am-1397",
                    url: "https://andymark.com/products/10-32-x-2-75-in-socket-head-cap-screw"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "am-1522",
                    url: "https://andymark.com/products/10-32-x-3-in-socket-head-cap-screw"
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    partNumber: "am-1258",
                    url: "https://andymark.com/products/10-32-x-3-25-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_3_5",
                    name: "3-1/2 in.",
                    length: 0.0889,
                    partNumber: "am-1402",
                    url: "https://andymark.com/products/10-32-x-3-5-in-socket-head-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_10_32",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "am-1588",
                    url: "https://andymark.com/products/10-32-x-3-8-in-button-head-cap-screw-with-nylon-patch"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "am-1512",
                    url: "https://andymark.com/products/10-32-x-0-5-in-button-head-cap-screw"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "am-1549",
                    url: "https://andymark.com/products/10-32-x-0-625-in-button-head-cap-screw-with-nylon-patch"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "am-1524",
                    url: "https://andymark.com/products/10-32-x-0-75-in-hex-drive-button-head-cap-screw"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "am-1396",
                    url: "https://andymark.com/products/10-32-x-1-in-button-head-cap-screw-1"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "am-1260",
                    url: "https://andymark.com/products/10-32-x-1-25-in-button-head-cap-screw"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "am-1730",
                    url: "https://andymark.com/products/10-32-x-1-5-in-button-head-cap-screw"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "am-1584",
                    url: "https://andymark.com/products/10-32-x-1-75-in-button-head-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "NO_10_32",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "am-1404",
                    url: "https://andymark.com/products/10-32-x-0-5-in-flat-head-cap-screw"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "am-1252",
                    url: "https://andymark.com/products/10-32-x-0-625-in-flat-head-cap-screw"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "am-1170",
                    url: "https://andymark.com/products/10-32-x-0-75-in-flat-head-cap-screw"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "am-1324",
                    url: "https://andymark.com/products/10-32-x-1-in-flat-head-cap-screw-1"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "am-1756",
                    url: "https://andymark.com/products/10-32-x-1-500-in-flat-head-cap-screw"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "am-1383",
                    url: "https://andymark.com/products/10-32-x-2-in-flat-head-cap-screw-black-oxide"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "QUARTER_20",
            head: "SOCKET",
            lengths: [
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "am-1053",
                    url: "https://andymark.com/products/1-4-20-x-0-625-in-hex-drive-socket-head-cap-screw"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "am-1341",
                    url: "https://andymark.com/products/1-4-20-x-1-in-socket-head-cap-screw"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "am-1131",
                    url: "https://andymark.com/products/1-4-20-x-1-5-in-socket-head-cap-screw"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "am-1058",
                    url: "https://andymark.com/products/1-4-20-x-1-75-in-hex-drive-socket-head-cap-screw"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "am-1012",
                    url: "https://andymark.com/products/1-4-20-x-2-in-socket-head-cap-screw"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "am-1031",
                    url: "https://andymark.com/products/1-4-20-x-2-5-in-hex-drive-socket-head-cap-screw"
                },
                {
                    id: "IN_3",
                    name: "3 in.",
                    length: 0.0762,
                    partNumber: "am-1030",
                    url: "https://andymark.com/products/1-4-20-x-3-in-socket-head-cap-screw-1"
                },
                {
                    id: "IN_3_25",
                    name: "3-1/4 in.",
                    length: 0.08255,
                    partNumber: "am-3338",
                    url: "https://andymark.com/products/1-4-20-x-3-25-in-socket-head-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "QUARTER_20",
            head: "BUTTON",
            lengths: [
                {
                    id: "IN_0_375",
                    name: "3/8 in.",
                    length: 0.009525,
                    partNumber: "am-1520",
                    url: "https://andymark.com/products/1-4-20-x-0-375-in-button-head-cap-screw"
                },
                {
                    id: "IN_0_5",
                    name: "1/2 in.",
                    length: 0.0127,
                    partNumber: "am-1039",
                    url: "https://andymark.com/products/1-4-20-x-0-5-in-button-head-cap-screw"
                },
                {
                    id: "IN_0_625",
                    name: "5/8 in.",
                    length: 0.015875,
                    partNumber: "am-1681",
                    url: "https://andymark.com/products/1-4-20-x-0-625-in-button-head-cap-screw"
                },
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "am-1754",
                    url: "https://andymark.com/products/screw-bhcs-1-4-20-x-750-zinc"
                },
                {
                    id: "IN_1",
                    name: "1 in.",
                    length: 0.0254,
                    partNumber: "am-1525",
                    url: "https://andymark.com/products/1-4-20-x-1-in-button-head-cap-screw"
                },
                {
                    id: "IN_1_25",
                    name: "1-1/4 in.",
                    length: 0.03175,
                    partNumber: "am-1183",
                    url: "https://andymark.com/products/1-4-20-x-1-25-in-button-head-cap-screw"
                },
                {
                    id: "IN_1_5",
                    name: "1-1/2 in.",
                    length: 0.0381,
                    partNumber: "am-1118",
                    url: "https://andymark.com/products/1-4-20-x-1-5-in-button-head-cap-screw"
                },
                {
                    id: "IN_1_75",
                    name: "1-3/4 in.",
                    length: 0.04445,
                    partNumber: "am-1420",
                    url: "https://andymark.com/products/1-4-20-x-1-75-in-button-head-cap-screw"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "am-1655",
                    url: "https://andymark.com/products/1-4-20-x-2-in-button-head-cap-screw"
                },
                {
                    id: "IN_2_5",
                    name: "2-1/2 in.",
                    length: 0.0635,
                    partNumber: "am-1695",
                    url: "https://andymark.com/products/1-4-20-x-2-5-in-button-head-cap-screw"
                }
            ]
        },
        {
            vendor: "ANDYMARK",
            size: "QUARTER_20",
            head: "FLAT",
            lengths: [
                {
                    id: "IN_0_75",
                    name: "3/4 in.",
                    length: 0.01905,
                    partNumber: "am-1672",
                    url: "https://andymark.com/products/1-4-20-x-0-75-in-flat-head-cap-screw"
                },
                {
                    id: "IN_2",
                    name: "2 in.",
                    length: 0.0508,
                    partNumber: "am-1707",
                    url: "https://andymark.com/products/1-4-20-x-2-in-flat-head-cap-screw"
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
            thickness: 0.0008128
        },
        {
            vendor: "GENERIC",
            size: "NO_6_32",
            type: "OD_3_8_X_0_049",
            name: "3/8 in. OD x 0.049 in.",
            innerDiameter: 0.0039624,
            outerDiameter: 0.009525,
            thickness: 0.0012446
        },
        {
            vendor: "GENERIC",
            size: "NO_8_32",
            type: "OD_7_16_X_0_049",
            name: "7/16 in. OD x 0.049 in.",
            innerDiameter: 0.0047752,
            outerDiameter: 0.0111125,
            thickness: 0.0012446
        },
        {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "OD_1_2_X_0_049",
            name: "1/2 in. OD x 0.049 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.0127,
            thickness: 0.0012446
        },
        {
            vendor: "GENERIC",
            size: "QUARTER_20",
            type: "OD_5_8_X_0_065",
            name: "5/8 in. OD x 0.065 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.015875,
            thickness: 0.001651
        },
        {
            vendor: "MCMASTER",
            size: "NO_4_40",
            type: "OD_5_16_X_0_03",
            name: "5/16 in. OD x 0.03 in.",
            innerDiameter: 0.003175,
            outerDiameter: 0.0079375,
            thickness: 0.000762,
            partNumber: "96765A110",
            url: "https://www.mcmaster.com/96765A110/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_6_32",
            type: "OD_3_8_X_0_03",
            name: "3/8 in. OD x 0.03 in.",
            innerDiameter: 0.0039624,
            outerDiameter: 0.009525,
            thickness: 0.000762,
            partNumber: "96765A115",
            url: "https://www.mcmaster.com/96765A115/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_8_32",
            type: "OD_3_8_X_0_03",
            name: "3/8 in. OD x 0.03 in.",
            innerDiameter: 0.0047752,
            outerDiameter: 0.009525,
            thickness: 0.000762,
            partNumber: "96765A120",
            url: "https://www.mcmaster.com/96765A120/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "OD_7_16_X_0_03",
            name: "7/16 in. OD x 0.03 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.0111125,
            thickness: 0.000762,
            partNumber: "96765A125",
            url: "https://www.mcmaster.com/96765A125/"
        },
        {
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "OD_1_2_X_0_04",
            name: "1/2 in. OD x 0.04 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.0127,
            thickness: 0.001016,
            partNumber: "90377A123",
            url: "https://www.mcmaster.com/90377A123/"
        },
        {
            vendor: "MCMASTER",
            size: "QUARTER_20",
            type: "OD_5_8_X_0_05",
            name: "5/8 in. OD x 0.05 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.015875,
            thickness: 0.00127,
            partNumber: "96765A140",
            url: "https://www.mcmaster.com/96765A140/"
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            type: "OD_3_8_X_0_012",
            name: "3/8 in. OD x 0.012 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.009525,
            thickness: 0.0003048,
            partNumber: "WCP-0038",
            url: "https://wcproducts.com/products/wcp-0038"
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            type: "OD_3_8_X_0_031",
            name: "3/8 in. OD x 0.031 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.009525,
            thickness: 0.0007874,
            partNumber: "WCP-0197",
            url: "https://wcproducts.com/products/wcp-0197"
        },
        {
            vendor: "WCP",
            size: "NO_10_32",
            type: "OD_5_8_X_0_031",
            name: "5/8 in. OD x 0.031 in.",
            innerDiameter: 0.0055626,
            outerDiameter: 0.015875,
            thickness: 0.0007874,
            partNumber: "WCP-0523",
            url: "https://wcproducts.com/products/wcp-0523"
        },
        {
            vendor: "WCP",
            size: "QUARTER_20",
            type: "OD_3_8_X_0_012",
            name: "3/8 in. OD x 0.012 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.009525,
            thickness: 0.0003048,
            partNumber: "WCP-0039",
            url: "https://wcproducts.com/products/wcp-0039"
        },
        {
            vendor: "WCP",
            size: "QUARTER_20",
            type: "OD_3_8_X_0_031",
            name: "3/8 in. OD x 0.031 in.",
            innerDiameter: 0.0071374,
            outerDiameter: 0.009525,
            thickness: 0.0007874,
            partNumber: "WCP-0198",
            url: "https://wcproducts.com/products/wcp-0198"
        }
    ]
};
