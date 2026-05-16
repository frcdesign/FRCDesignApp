import { InstancePath } from "../../../shared/path";

/** The path to the Onshape standard library. */
export const STD_PATH: InstancePath = {
  documentId: "12312312345abcabcabcdeff",
  instanceType: "w",
  instanceId: "a855e4161c814f2e9ab3698a",
};

/** The name of the base version inside every Onshape document. */
export const START_VERSION_NAME = "Start";

/** The 4×4 identity transform, as a flat 16-element column-major array. */
export const IDENTITY_TRANSFORM = [
  1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
  1.0,
];
