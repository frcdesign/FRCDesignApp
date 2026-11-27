/**
 * Declared screws, planned as Auto Assembly plans a picked hole: from the
 * screw's connector into the holes behind it, with its declared length or the
 * one its holes need, and its declared nut where it comes out the far side.
 * Pure.
 */
import { type Selection } from "../configurations/contract";
import {
    partStudioInsertOverrides,
    toSelection
} from "../configurations/selection";
import { type Catalog, getNut, Program } from "./catalog";
import {
    DEFAULT_MAX_THREAD_DEPTH,
    DeclaredPartStatus,
    FastenerMode,
    type FastenerOptions,
    HoleStatus,
    StopCondition
} from "./contract";
import {
    type DeclaredPlan,
    type DeclaredProduct,
    productKey
} from "./declared";
import { frameTransform, scale } from "./geometry";
import { DeclaredKind } from "./part-scan";
import {
    type AssemblyCircularEdge,
    type AssemblyHole,
    type PlacedScrew,
    planHoles
} from "./planner";
import { type PartChoice, type ScrewChoice } from "./studios";

/** What a declared screw's plan is planned against. */
export interface ScrewContext {
    catalog: Catalog;
    holes: AssemblyHole[];
    placed: PlacedScrew[];
    /** The declared nuts' studios, by `productKey`. */
    products: Map<string, DeclaredProduct>;
}

/** Whether a plan is a declared screw's that a planner decides. */
export function isScrewPlan(plan: DeclaredPlan): boolean {
    return (
        plan.status === DeclaredPartStatus.READY &&
        plan.connector.declaration.kind === DeclaredKind.SCREW
    );
}

/** The nut its vendor makes in the screw's size, or else any vendor's, as a run would insert it. */
function nutChoice(
    catalog: Catalog,
    screw: ScrewChoice,
    selection: Selection
): PartChoice | undefined {
    const { type } = selection;
    const vendor = [screw.vendor, selection.vendor].find(
        (each) => each && getNut(catalog, each, screw.size, type)
    );
    const any = catalog.nuts.find(
        (nut) => nut.size === screw.size && nut.type === type
    );
    const made = vendor ?? any?.vendor;
    if (!made) {
        return undefined;
    }
    return {
        vendor: made,
        size: screw.size,
        type,
        ...(selection.finish ? { finish: selection.finish } : {})
    };
}

/**
 * Each ready screw's plan replaced by its planner's: ready with its length and
 * nut, already placed where a library screw is on it, or why it can't go in.
 */
export function planScrews(
    plans: DeclaredPlan[],
    context: ScrewContext
): DeclaredPlan[] {
    return plans.map((plan) =>
        isScrewPlan(plan) ? planScrew(plan, context) : plan
    );
}

function planScrew(plan: DeclaredPlan, context: ScrewContext): DeclaredPlan {
    const { connector, product } = plan;
    const { declaration } = connector;
    if (!product) {
        return plan;
    }
    const selection = toSelection(
        declaration.configuration,
        product.parameters
    );
    const screw: ScrewChoice = {
        vendor: selection.vendor,
        size: selection.size,
        head: selection.head,
        finish: selection.finish,
        length: selection.length,
        fullyThreaded: selection.fullyThreaded ?? "false"
    };
    const nutProduct =
        declaration.nut && context.products.get(productKey(declaration.nut));
    const nut =
        declaration.nut && nutProduct
            ? nutChoice(
                  context.catalog,
                  screw,
                  toSelection(
                      declaration.nut.configuration,
                      nutProduct.parameters
                  )
              )
            : undefined;
    const options: FastenerOptions = {
        program: Program.FRC,
        mode:
            declaration.configuration.length === undefined
                ? FastenerMode.AUTOMATIC
                : FastenerMode.PRESET,
        screw,
        ...(nut ? { nut } : {}),
        stop: StopCondition.ALL_HOLES,
        maxThreadDepth: DEFAULT_MAX_THREAD_DEPTH
    };
    const into = scale(connector.zAxis, -1);
    const seatHeight = numberSpec(declaration.spec.seatHeight);
    const seatHoleDiameter = numberSpec(declaration.spec.seatHoleDiameter);
    // A part placed in the same run, which no scan has: its hole, from the seat
    const standIn: AssemblyHole[] =
        seatHeight && seatHoleDiameter
            ? [
                  {
                      occurrencePath: [...connector.hostPath, connector.key],
                      origin: connector.origin,
                      direction: into,
                      radius: seatHoleDiameter / 2,
                      start: 0,
                      end: seatHeight,
                      closedAtStart: false,
                      closedAtEnd: false,
                      threaded: false,
                      edges: []
                  }
              ]
            : [];
    const edge: AssemblyCircularEdge = {
        key: connector.key,
        occurrencePath: connector.hostPath,
        edgeId: "",
        center: connector.origin,
        normal: connector.zAxis,
        radius: (seatHoleDiameter ?? 0) / 2
    };
    const [holePlan] = planHoles(
        [edge],
        [...context.holes, ...standIn],
        context.placed,
        options,
        context.catalog
    );
    const { planned, exit } = holePlan;
    if (planned.status === HoleStatus.FASTENED) {
        return { connector, status: DeclaredPartStatus.PLACED, product };
    }
    if (planned.status !== HoleStatus.READY || !planned.screw) {
        return {
            connector,
            status: DeclaredPartStatus.UNPLACEABLE,
            reason: planned.reason ?? "This screw doesn't fit its holes."
        };
    }
    return {
        ...plan,
        configuration: partStudioInsertOverrides(
            toSelection({ ...planned.screw }, product.parameters),
            product.parameters
        ),
        ...(planned.warning ? { warning: planned.warning } : {}),
        ...(planned.nut && exit && nutProduct
            ? {
                  nut: {
                      product: nutProduct,
                      configuration: partStudioInsertOverrides(
                          toSelection(
                              { ...planned.nut },
                              nutProduct.parameters
                          ),
                          nutProduct.parameters
                      ),
                      name: declaration.nut?.name ?? "",
                      transform: frameTransform(exit.point, into),
                      edge: exit.edge
                  }
              }
            : {})
    };
}

function numberSpec(value: unknown): number | undefined {
    return typeof value === "number" && value > 0 ? value : undefined;
}
