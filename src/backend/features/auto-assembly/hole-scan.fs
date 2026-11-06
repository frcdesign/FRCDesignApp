FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

/**
 * What FRCDesignApp needs to know about a Part Studio to fasten parts from it: each part's holes, and
 * the circles and faces selected in an assembly. The app evaluates it with Onshape's FeatureScript evaluation, which
 * takes a lambda: `holeScanLambda` in `scan.ts` sends this function's body, so it uses nothing but std's common.fs,
 * and keeps its helpers inside it. `scan.ts` parses what it returns.
 *
 * Lengths are unitless meters, and points and directions are in the Part Studio's coordinates.
 *
 * @param queries {{
 *      @field edges {Query} : @optional Circular edges selected to fasten.
 *      @field faces {Query} : @optional Faces selected to fasten each hole in.
 * }}
 * @returns {{
 *      @field parts {map} : By part id, its `holes`: each cylindrical hole's `origin` and `direction` (its axis), its
 *              `radius`, its `start` and `end` along the axis from `origin`, whether each end is `closedAtStart` or
 *              `closedAtEnd` (the part goes on past it, as at the bottom of a blind hole), its circular `edges` (each
 *              `id`, and where it is along the axis, `at`), and `threaded` with its `majorDiameter` if a Hole feature
 *              tapped it.
 *      @field circles {array} : Each selected circle, and each circle bounding a selected face: its `id`, its `partId`,
 *              its `center`, `radius`, and `normal` (out of the part, along the hole), and `faceId` if it came from a
 *              selected face.
 * }}
 */
export function fastenerHoleScan(context is Context, queries is map) returns map
{
    const toMeters = function(point is Vector) returns array
        {
            return [point[0] / meter, point[1] / meter, point[2] / meter];
        };
    const toArray = function(direction is Vector) returns array
        {
            return [direction[0], direction[1], direction[2]];
        };
    const idOf = function(entity is Query) returns string
        {
            return transientQueriesToStrings(entity);
        };

    // A hole's faces face its axis, which a boss's don't
    const scanHole = function(body is Query, face is Query)
        {
            const cylinder = evSurfaceDefinition(context, { "face" : face });
            if (!(cylinder is Cylinder))
            {
                return undefined;
            }
            const axis = cylinder.coordSystem;
            const tangent = evFaceTangentPlane(context, { "face" : face, "parameter" : vector(0.5, 0.5) });
            const towardAxis = tangent.origin - project(line(axis.origin, axis.zAxis), tangent.origin);
            if (dot(tangent.normal, towardAxis) >= 0 * meter)
            {
                return undefined;
            }
            const extent = evBox3d(context, { "topology" : face, "cSys" : axis, "tight" : true });
            const start = extent.minCorner[2];
            const end = extent.maxCorner[2];
            // Whether the part goes on past an end, probed inside the hole's radius
            const probe = cylinder.radius / 2;
            const closedAtStart = !isQueryEmpty(context, qContainsPoint(body, axis.origin + axis.zAxis * (start - probe)));
            const closedAtEnd = !isQueryEmpty(context, qContainsPoint(body, axis.origin + axis.zAxis * (end + probe)));

            // Its circular edges, by where they are along the axis: a nut or a screw is fastened to one
            var edges = [];
            for (var edge in evaluateQuery(context, qAdjacent(face, AdjacencyType.EDGE, EntityType.EDGE)->qGeometry(GeometryType.CIRCLE)))
            {
                const center = evCurveDefinition(context, { "edge" : edge }).coordSystem.origin;
                edges = append(edges, { "id" : idOf(edge), "at" : dot(center - axis.origin, axis.zAxis) / meter });
            }

            var hole = {
                "faceId" : idOf(face),
                "edges" : edges,
                "origin" : toMeters(axis.origin),
                "direction" : toArray(axis.zAxis),
                "radius" : cylinder.radius / meter,
                "start" : start / meter,
                "end" : end / meter,
                "closedAtStart" : closedAtStart,
                "closedAtEnd" : closedAtEnd,
                "threaded" : false
            };
            for (var attribute in getAttributes(context, { "entities" : face }))
            {
                if (attribute is map && attribute.isTappedHole is boolean && attribute.isTappedHole && attribute.majorDiameter != undefined)
                {
                    hole.threaded = true;
                    hole.majorDiameter = attribute.majorDiameter / meter;
                }
            }
            return hole;
        };

    // Its normal points out of the part, so the fastener goes in against it
    const scanCircle = function(edge is Query, faceId)
        {
            const curve = evCurveDefinition(context, { "edge" : edge });
            if (!(curve is Circle))
            {
                return undefined;
            }
            var normal = curve.coordSystem.zAxis;
            const planes = qAdjacent(edge, AdjacencyType.EDGE, EntityType.FACE)->qGeometry(GeometryType.PLANE);
            if (!isQueryEmpty(context, planes))
            {
                normal = evPlane(context, { "face" : qNthElement(planes, 0) }).normal;
            }
            var circle = {
                "id" : idOf(edge),
                // An owner query isn't transient: its one body is
                "partId" : idOf(evaluateQuery(context, qOwnerBody(edge))[0]),
                "center" : toMeters(curve.coordSystem.origin),
                "radius" : curve.radius / meter,
                "normal" : toArray(normal)
            };
            if (faceId != undefined)
            {
                circle.faceId = faceId;
            }
            return circle;
        };

    var parts = {};
    for (var body in evaluateQuery(context, qAllSolidBodies()))
    {
        var holes = [];
        for (var face in evaluateQuery(context, qOwnedByBody(body, EntityType.FACE)->qGeometry(GeometryType.CYLINDER)))
        {
            const hole = scanHole(body, face);
            if (hole != undefined)
            {
                holes = append(holes, hole);
            }
        }
        parts[idOf(body)] = { "holes" : holes };
    }

    var circles = [];
    if (queries.edges != undefined)
    {
        for (var edge in evaluateQuery(context, queries.edges))
        {
            const circle = scanCircle(edge, undefined);
            if (circle != undefined)
            {
                circles = append(circles, circle);
            }
        }
    }
    if (queries.faces != undefined)
    {
        for (var face in evaluateQuery(context, queries.faces))
        {
            const faceId = idOf(face);
            for (var edge in evaluateQuery(context, qAdjacent(face, AdjacencyType.EDGE, EntityType.EDGE)->qGeometry(GeometryType.CIRCLE)))
            {
                const circle = scanCircle(edge, faceId);
                if (circle != undefined)
                {
                    circles = append(circles, circle);
                }
            }
        }
    }
    return { "parts" : parts, "circles" : circles };
}
