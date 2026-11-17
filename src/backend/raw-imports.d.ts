/** FeatureScript the Worker sends Onshape to evaluate, imported as its source text. */
declare module "*.fs?raw" {
    const source: string;
    export default source;
}
