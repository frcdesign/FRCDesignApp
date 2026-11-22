import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { type Db, getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { INSTANCE_TYPES, type ElementPath } from "../../lib/onshape/path";
import { getAssemblyBom } from "../../lib/onshape/endpoints/assemblies";
import {
    getPartMetadata,
    type PartMetadataPath,
    updatePartMetadata
} from "../../lib/onshape/endpoints/metadata";
import type { OnshapePartMetadata } from "../../lib/onshape/types";
import { requireSignInMiddleware } from "../auth/guards";
import { trackMassEdit, trackMassReport } from "../analytics/tracking";
import { toMassReport } from "./bom";
import { type MassReportOut, type PartSource } from "./contract";
import { findMaterial, type Material } from "./materials";

export const massAnalysisRoutes = getApp();

const elementPathSchema = z.object({
    documentId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    instanceId: z.string().min(1),
    elementId: z.string().min(1)
});

const partSchema = elementPathSchema.extend({
    partId: z.string().min(1),
    configuration: z.string()
});

const partPropertiesBody = z
    .object({
        assembly: elementPathSchema,
        part: partSchema,
        material: z
            .string()
            .refine((name) => findMaterial(name) !== undefined)
            .optional(),
        mass: z.number().positive().optional()
    })
    .refine(
        (body) => body.material !== undefined || body.mass !== undefined,
        "A material or a mass to set."
    );

async function getLibraryDocumentIds(db: Db): Promise<Set<string>> {
    const rows = await db
        .selectDistinct({ documentId: groups.documentId })
        .from(groups)
        .all();
    return new Set(rows.map((row) => row.documentId));
}

/**
 * GET /api/mass-analysis?documentId=&instanceType=&instanceId=&elementId= —
 * the assembly's parts and subassemblies, with each part's mass, read from its
 * BOM as the caller.
 */
massAnalysisRoutes.get(
    "/mass-analysis",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", elementPathSchema),
    async (c) => {
        const assembly = c.req.valid("query");
        const [bom, libraryDocumentIds] = await Promise.all([
            getAssemblyBom(await c.var.getOnshapeApi(), assembly),
            getLibraryDocumentIds(getDb(c.env.DB))
        ]);
        const report = toMassReport(bom, { assembly, libraryDocumentIds });
        await trackMassReport(c, assembly);
        return c.json(report satisfies MassReportOut);
    }
);

/** Shaped as a material library's entry, since Onshape doesn't document a part's. */
function toMaterialValue(material: Material): unknown {
    return {
        id: material.name,
        displayName: material.name,
        libraryName: "Onshape Material Library",
        properties: [
            {
                name: "DENS",
                displayName: "Density",
                category: "Physical",
                type: "REAL",
                units: "kg/m^3",
                value: String(material.density)
            }
        ]
    };
}

function requireProperty(metadata: OnshapePartMetadata, name: string): string {
    const property = metadata.properties.find(
        (candidate) => candidate.name === name
    );
    if (!property || property.editable === false) {
        throw handledError(
            `This part's ${name.toLowerCase()} can't be set.`,
            HttpStatus.CONFLICT
        );
    }
    return property.propertyId;
}

function studioOf(part: PartSource): ElementPath {
    return {
        documentId: part.documentId,
        instanceType: part.instanceType,
        instanceId: part.instanceId,
        elementId: part.elementId
    };
}

function toMetadataPath(
    assembly: ElementPath,
    part: PartSource
): PartMetadataPath {
    return {
        studio: studioOf(part),
        partId: part.partId,
        configuration: part.configuration,
        linkDocumentId:
            part.documentId === assembly.documentId
                ? undefined
                : assembly.documentId
    };
}

/**
 * POST /api/mass-analysis/part — sets a part's material, its mass override, or
 * both, in its own Part Studio. A material is set only in the assembly's own
 * workspace; nothing is set in a library's document.
 */
massAnalysisRoutes.post(
    "/mass-analysis/part",
    requireSignInMiddleware,
    validate("json", partPropertiesBody),
    async (c) => {
        const { assembly, part, material, mass } = c.req.valid("json");
        const isOwnWorkspace =
            part.documentId === assembly.documentId &&
            part.instanceType === "w";
        if (material !== undefined && !isOwnWorkspace) {
            throw handledError(
                "Only a part in this document can have its material set.",
                HttpStatus.BAD_REQUEST
            );
        }
        const libraryDocumentIds = await getLibraryDocumentIds(getDb(c.env.DB));
        if (
            part.instanceType === "m" ||
            libraryDocumentIds.has(part.documentId)
        ) {
            throw handledError(
                "A library part can't be changed.",
                HttpStatus.BAD_REQUEST
            );
        }

        const api = await c.var.getOnshapeApi();
        const path = toMetadataPath(assembly, part);
        const metadata = await getPartMetadata(api, path);
        const properties: { propertyId: string; value: unknown }[] = [];
        const chosen =
            material === undefined ? undefined : findMaterial(material);
        if (chosen) {
            properties.push({
                propertyId: requireProperty(metadata, "Material"),
                value: toMaterialValue(chosen)
            });
        }
        if (mass !== undefined) {
            properties.push({
                propertyId: requireProperty(metadata, "Mass override"),
                value: `${mass} kg`
            });
        }
        await updatePartMetadata(api, path, properties);
        await trackMassEdit(c, {
            path: studioOf(part),
            material: chosen !== undefined,
            mass: mass !== undefined
        });
        return c.json({});
    }
);
