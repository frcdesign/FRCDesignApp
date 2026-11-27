FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

/**
 * The parts a Part Studio's FeatureScripts declared for Auto Assembly: each mate connector carrying robot-code's
 * `frcAutoAssembly` attribute (its `core/autoAssembly.fs`) on a part it attaches to. A connector on an Auto Assembly
 * body, which carries the attribute itself, is left out. The app evaluates it with Onshape's FeatureScript evaluation,
 * which takes a lambda: `declaredScanLambda` in `part-scan.ts` sends this function's body, so it uses nothing but std's
 * common.fs, and keeps its helpers inside it. `part-scan.ts` parses what it returns.
 *
 * Lengths are unitless meters, and points and directions are in the Part Studio's coordinates.
 *
 * @returns {{
 *      @field connectors {array} : Each declaring connector: its `partId`, its `connectorId` as a fasten mate names
 *              it (the id of the operation that made it, joined with "."), its `origin`, `xAxis` and `zAxis`, and its
 *              `declaration`: the attribute, with `kind` as its name and each length in `spec` in meters. With `flip`,
 *              the far side of its hole: the part's circular edge on its axis farthest behind it (its `edgeId`, and
 *              its center as `origin`), where a part flipped to the other side seats.
 * }}
 */
export function declaredPartScan(context is Context, queries is map) returns map
{
    const ATTRIBUTE = "frcAutoAssembly";
    const toMeters = function(point is Vector) returns array
        {
            return [point[0] / meter, point[1] / meter, point[2] / meter];
        };
    const toArray = function(direction is Vector) returns array
        {
            return [direction[0], direction[1], direction[2]];
        };
    // Each value as plain JSON reads it: a length in meters, an enum by its name
    const plain = function(value)
        {
            if (isLength(value))
            {
                return value / meter;
            }
            if (value is number || value is string || value is boolean || value == undefined)
            {
                return value;
            }
            return toString(value);
        };

    // The farthest circle of the part on the connector's axis, behind it
    const farSide = function(body is Query, coordSystem is CoordSystem)
        {
            const tolerance = 1e-5 * meter;
            var found = undefined;
            var farthest = -tolerance;
            for (var edge in evaluateQuery(context, qOwnedByBody(body, EntityType.EDGE)->qGeometry(GeometryType.CIRCLE)))
            {
                const circle = evCurveDefinition(context, { "edge" : edge }).coordSystem;
                const offset = circle.origin - coordSystem.origin;
                const along = dot(offset, coordSystem.zAxis);
                if (along > farthest || norm(offset - coordSystem.zAxis * along) > tolerance ||
                    !parallelVectors(circle.zAxis, coordSystem.zAxis))
                {
                    continue;
                }
                farthest = along;
                found = { "edgeId" : transientQueriesToStrings(edge), "origin" : toMeters(circle.origin) };
            }
            return found;
        };

    var connectors = [];
    for (var body in evaluateQuery(context, qAllSolidBodies()))
    {
        if (getAttribute(context, { "entity" : body, "name" : ATTRIBUTE }) != undefined)
        {
            continue;
        }
        const partId = transientQueriesToStrings(body);
        for (var connector in evaluateQuery(context, qMateConnectorsOfParts(body)))
        {
            const attribute = getAttribute(context, { "entity" : connector, "name" : ATTRIBUTE });
            if (!(attribute is map))
            {
                continue;
            }
            var connectorId = "";
            for (var part in lastModifyingOperationId(context, connector))
            {
                connectorId = connectorId == "" ? part : connectorId ~ "." ~ part;
            }
            var configuration = {};
            for (var key, value in attribute.configuration)
            {
                configuration[key] = toString(value);
            }
            var spec = {};
            for (var key, value in attribute.spec)
            {
                spec[key] = plain(value);
            }
            const coordSystem = evMateConnector(context, { "mateConnector" : connector });
            connectors = append(connectors, {
                        "partId" : partId,
                        "flip" : farSide(body, coordSystem),
                        "connectorId" : connectorId,
                        "origin" : toMeters(coordSystem.origin),
                        "xAxis" : toArray(coordSystem.xAxis),
                        "zAxis" : toArray(coordSystem.zAxis),
                        "declaration" : {
                            "version" : attribute.version,
                            "kind" : toString(attribute.kind),
                            "documentId" : attribute.documentId,
                            "elementId" : attribute.elementId,
                            "configuration" : configuration,
                            "name" : attribute.name,
                            "connector" : attribute.connector,
                            "spec" : spec
                        }
                    });
        }
    }
    return { "connectors" : connectors };
}
