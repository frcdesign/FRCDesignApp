import {
    alt,
    apply,
    buildLexer,
    expectEOF,
    expectSingleResult,
    kmid,
    opt,
    rep_sc,
    rule,
    seq,
    tok
} from "typescript-parsec";
import { getDisplayStr, QuantityType, Unit } from "../api/models";

class ParseError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

const TOLERANCE = {
    number: 1e-13,
    length: 1e-8,
    angle: 1e-11
};

export function valueWithUnits(value: number, unit: Unit): ValueWithUnits {
    return { value: value * getUnitFactor(unit), type: getUnitType(unit) };
}

function tolerantEqualsZero(value: ValueWithUnits) {
    return tolerantEquals(value, { value: 0, type: value.type });
}

function tolerantEquals(value1: ValueWithUnits, value2: ValueWithUnits) {
    if (value1.type !== value2.type) {
        throw new ParseError("Cannot compare values with different units");
    }
    const tolerance = TOLERANCE[value1.type];
    return Math.abs(value1.value - value2.value) < tolerance;
}

function tolerantLessThan(value1: ValueWithUnits, value2: ValueWithUnits) {
    if (value1.type !== value2.type) {
        throw new ParseError("Cannot compare values with different units");
    }
    const tolerance = TOLERANCE[value1.type];
    return value1.value < value2.value - tolerance;
}

function tolerantGreaterThan(value1: ValueWithUnits, value2: ValueWithUnits) {
    if (value1.type !== value2.type) {
        throw new ParseError("Cannot compare values with different units");
    }
    const tolerance = TOLERANCE[value1.type];
    return value1.value > value2.value + tolerance;
}

enum TokenKind {
    Number,
    Identifier,
    MulDivide,
    PlusMinus,
    LParen,
    RParen,
    Space
}

const lexer = buildLexer([
    // Allow a number plus optional decimal OR a decimal plus number
    [true, /^(?:\d+(?:\.\d*)?|\.\d+)/g, TokenKind.Number],
    [true, /^[A-Za-z]+/g, TokenKind.Identifier],
    [true, /^[*/]/g, TokenKind.MulDivide],
    [true, /^[+-]/g, TokenKind.PlusMinus],
    [true, /^\(/g, TokenKind.LParen],
    [true, /^\)/g, TokenKind.RParen],
    [false, /^\s+/g, TokenKind.Space] // skip whitespace
]);

type UnitType = "length" | "angle" | "number";

type Operator = "+" | "-" | "*" | "/";

interface ValueWithUnits {
    value: number;
    type: UnitType;
}

interface ValueLiteral {
    value: number;
    /**
     * The raw string value.
     * Used to maintain decimal accuracy.
     */
    rawValue: string;
    type: UnitType;
    unit: Unit;
}

interface ValueExpr {
    kind: "value";
    value: ValueLiteral;
}

interface BinaryExpr {
    kind: "binary";
    op: Operator;
    left: Expr;
    right: Expr;
}

interface UnaryExpr {
    kind: "unary";
    op: "+" | "-";
    expr: Expr;
}

interface ParenExpr {
    kind: "paren";
    expr: Expr;
}

interface UnitApplicationExpr {
    kind: "unit-application";
    expr: Expr;

    unit: Unit;
    type: UnitType;
}

type Expr =
    | ValueExpr
    | BinaryExpr
    | UnaryExpr
    | ParenExpr
    | UnitApplicationExpr;

// base unit: meter
export function getUnitFactor(unit: Unit): number {
    switch (unit) {
        // length (base = meter)
        case Unit.METER:
            return 1;
        case Unit.CENTIMETER:
            return 0.01;
        case Unit.MILLIMETER:
            return 0.001;
        case Unit.YARD:
            return 0.9144;
        case Unit.FOOT:
            return 0.3048;
        case Unit.INCH:
            return 0.0254;

        // angle (base = radian)
        case Unit.RADIAN:
            return 1;
        case Unit.DEGREE:
            return Math.PI / 180;

        // unitless
        case Unit.UNITLESS:
            return 1;
    }
}

function getUnitType(unit: Unit): UnitType {
    switch (unit) {
        // length
        case Unit.METER:
        case Unit.CENTIMETER:
        case Unit.MILLIMETER:
        case Unit.YARD:
        case Unit.FOOT:
        case Unit.INCH:
            return "length";

        // angle
        case Unit.DEGREE:
        case Unit.RADIAN:
            return "angle";

        case Unit.UNITLESS:
            return "number";
    }
}

export function classifyUnit(identifier: string): Unit {
    switch (identifier.toLowerCase()) {
        // length units
        case "m":
        case "meter":
        case "meters":
            return Unit.METER;

        case "cm":
        case "centimeter":
        case "centimeters":
            return Unit.CENTIMETER;

        case "mm":
        case "millimeter":
        case "millimeters":
            return Unit.MILLIMETER;

        case "in":
        case "inch":
        case "inches":
            return Unit.INCH;

        case "ft":
        case "foot":
        case "feet":
            return Unit.FOOT;

        case "yd":
        case "yard":
        case "yards":
            return Unit.YARD;

        // angle units
        case "deg":
        case "degree":
        case "degrees":
            return Unit.DEGREE;

        case "rad":
        case "radian":
        case "radians":
            return Unit.RADIAN;

        // Note: Unitless isn't supported by this
        default:
            throw new ParseError(`Unknown unit: ${identifier}`);
    }
}

const EXP = rule<TokenKind, Expr>();
const TERM = rule<TokenKind, Expr>();

const PRIMARY = rule<TokenKind, Expr>();
const FACTOR = rule<TokenKind, Expr>();

PRIMARY.setPattern(
    alt(
        // number with optional unit
        apply(
            seq(tok(TokenKind.Number), opt(tok(TokenKind.Identifier))),
            ([numTok, unitTok]) => {
                const unit = unitTok
                    ? classifyUnit(unitTok.text)
                    : Unit.UNITLESS;

                const valueLiteral: ValueLiteral = {
                    value: parseFloat(numTok.text) * getUnitFactor(unit),
                    type: getUnitType(unit),
                    rawValue: numTok.text,
                    unit
                };

                return { kind: "value", value: valueLiteral };
            }
        ),
        // (expr) with optional unit
        apply(
            seq(
                kmid(tok(TokenKind.LParen), EXP, tok(TokenKind.RParen)),
                opt(tok(TokenKind.Identifier))
            ),
            ([expr, unitTok]) => {
                if (unitTok) {
                    const unit = classifyUnit(unitTok.text);
                    // Wrap parens in unit-application
                    return {
                        kind: "unit-application",
                        expr: { kind: "paren", expr },
                        unit,
                        type: getUnitType(unit)
                    };
                }
                return { kind: "paren", expr };
            }
        )
    )
);

FACTOR.setPattern(
    alt(
        apply(seq(tok(TokenKind.PlusMinus), FACTOR), ([opTok, expr]) => {
            return { kind: "unary", op: opTok.text as "+" | "-", expr };
        }),
        PRIMARY
    )
);

// FACTOR.setPattern(
//     alt(
//         apply(
//             seq(tok(TokenKind.Number), opt(tok(TokenKind.Identifier))),
//             ([numTok, unitTok]) => {
//                 const unit = unitTok
//                     ? classifyUnit(unitTok.text)
//                     : Unit.UNITLESS;

//                 const valueLiteral: ValueLiteral = {
//                     value: parseFloat(numTok.text) * getUnitFactor(unit),
//                     type: getUnitType(unit),
//                     rawValue: numTok.text,
//                     unit: unit
//                 };

//                 return {
//                     kind: "value",
//                     value: valueLiteral
//                 };
//             }
//         ),
//         kmid(tok(TokenKind.LParen), EXP, tok(TokenKind.RParen))
//     )
// );

TERM.setPattern(
    apply(
        seq(FACTOR, rep_sc(seq(tok(TokenKind.MulDivide), FACTOR))),
        ([first, rest]) =>
            rest.reduce<Expr>(
                (acc, [opTok, rhs]) => ({
                    kind: "binary",
                    // Should always be a valid operator due to regex
                    op: opTok.text as unknown as Operator,
                    left: acc,
                    right: rhs
                }),
                first
            )
    )
);

EXP.setPattern(
    apply(
        seq(TERM, rep_sc(seq(tok(TokenKind.PlusMinus), TERM))),
        ([first, rest]) =>
            rest.reduce<Expr>(
                (acc, [opTok, rhs]) => ({
                    kind: "binary",
                    // Should always be a valid operator due to regex
                    op: opTok.text as unknown as Operator,
                    left: acc,
                    right: rhs
                }),
                first
            )
    )
);

/**
 * Parses an expression into a valid Expr AST.
 */
function parseExpression(input: string): Expr {
    const tokens = lexer.parse(input);
    const result = EXP.parse(tokens);
    if (result.successful) {
        return expectSingleResult(expectEOF(result));
    } else {
        // Throw as normal error so it gets redirected to a generic error message
        throw new Error(result.error.toString());
    }
}

function getOpName(op: Operator): string {
    switch (op) {
        case "+":
            return "add";
        case "-":
            return "subtract";
        case "*":
            return "multiply";
        case "/":
            return "divide";
    }
}

/**
 * Recursively checks the type of an expression.
 * To match Onshape, type assumption is only done on the final result, so unitless + unit is always invalid.
 * We also disallow units if quantityType is a unitless type.
 */
function evaluateExpressionValue(
    expr: Expr,
    quantityType: QuantityType
): ValueWithUnits {
    const isUnitlessType =
        quantityType === QuantityType.INTEGER ||
        quantityType === QuantityType.REAL;

    switch (expr.kind) {
        case "value": {
            const type = expr.value.type;
            if (isUnitlessType && type !== "number") {
                throw new ParseError(
                    `Number cannot have ${type} unit ${expr.value.unit}`
                );
            } else if (
                quantityType === QuantityType.ANGLE &&
                type === "length"
            ) {
                throw new ParseError(
                    `Angle cannot have length unit ${expr.value.unit}`
                );
            }
            return expr.value;
        }

        case "unit-application": {
            const inner = evaluateExpressionValue(expr.expr, quantityType);
            if (inner.type !== "number") {
                throw new ParseError(
                    `Cannot add unit to ${inner.type} expression`
                );
            }
            return {
                value: inner.value * getUnitFactor(expr.unit),
                type: getUnitType(expr.unit)
            };
        }

        case "unary": {
            const inner = evaluateExpressionValue(expr.expr, quantityType);
            if (expr.op === "+") return inner;
            return { ...inner, value: -inner.value };
        }
        case "paren":
            return evaluateExpressionValue(expr.expr, quantityType);

        case "binary": {
            const left = evaluateExpressionValue(expr.left, quantityType);
            const right = evaluateExpressionValue(expr.right, quantityType);

            switch (expr.op) {
                case "+":
                    if (left.type !== right.type) {
                        const opName = getOpName(expr.op);
                        throw new ParseError(
                            // cannot add number and length
                            `Cannot ${opName} ${left.type} and ${right.type}`
                        );
                    }
                    return { value: left.value + right.value, type: left.type };
                case "-":
                    if (left.type !== right.type) {
                        const opName = getOpName(expr.op);
                        throw new ParseError(
                            // cannot add number and length
                            `Cannot ${opName} ${left.type} and ${right.type}`
                        );
                    }
                    return { value: left.value - right.value, type: left.type };

                case "*":
                    // number * unit -> unit
                    if (left.type === "number") {
                        return {
                            value: left.value * right.value,
                            type: right.type
                        };
                    }
                    if (right.type === "number") {
                        return {
                            value: left.value * right.value,
                            type: left.type
                        };
                    }

                    // Could allow area/volume, but for now disallow
                    throw new ParseError(
                        `Cannot multiply ${left.type} and ${right.type}`
                    );

                case "/":
                    // unit / number -> unit
                    // number / number -> number
                    if (right.type === "number") {
                        if (tolerantEqualsZero(right)) {
                            throw new ParseError(`Cannot divide by 0`);
                        }

                        return {
                            value: left.value / right.value,
                            type: left.type
                        };
                    }

                    // number / unit -> disallow (would be inverse unit, which we don't support)
                    if (left.type === "number") {
                        throw new ParseError(
                            `Cannot divide ${left.type} by ${right.type}`
                        );
                    }

                    // unit / unit -> disallow (dimensionless ratio would be possible)
                    throw new ParseError(
                        `Cannot divide ${left.type} by ${right.type}`
                    );
            }
        }
    }
}

function applyDefaultUnit(
    value: ValueWithUnits,
    defaultUnit: Unit
): ValueWithUnits {
    // Convert a number into the given unit
    return valueWithUnits(value.value, defaultUnit);
}

/**
 * Converts an expression AST back into a string.
 */
function stringify(expr: Expr): string {
    switch (expr.kind) {
        case "value": {
            const value = expr.value;
            if (value.type === "number") {
                return value.rawValue;
            }
            return value.rawValue + " " + getDisplayStr(value.unit);
        }
        case "unit-application":
            return `${stringify(expr.expr)} ${getDisplayStr(expr.unit)}`;
        case "unary":
            return `${expr.op}${stringify(expr.expr)}`;
        case "paren":
            return `(${stringify(expr.expr)})`;
        case "binary": {
            return `${stringify(expr.left)} ${expr.op} ${stringify(
                expr.right
            )}`;
        }
    }
}

export function formatValueWithUnits(
    value: ValueWithUnits,
    displayUnit: Unit,
    displayPrecision: number
): string {
    return `${roundToPrecision(
        value.value / getUnitFactor(displayUnit),
        displayPrecision
    )} ${getDisplayStr(displayUnit)}`;
}

/**
 * Rounds number to a given precision. Unlike toFixed, drops trailing zeros.
 */
function roundToPrecision(num: number, precision: number): string {
    const factor = Math.pow(10, precision);
    return String(Math.round(num * factor) / factor);
}

function formatExpression(
    expr: Expr,
    value: ValueWithUnits,
    options: EvaluateOptions
): Result | ErrorResult {
    const { quantityType, displayUnit, displayPrecision } = options;

    let expression = stringify(expr);
    if (
        (quantityType === QuantityType.LENGTH ||
            quantityType === QuantityType.ANGLE) &&
        value.type === "number"
    ) {
        value = applyDefaultUnit(value, displayUnit);

        if (expr.kind === "binary") {
            expression = `(${expression})`;
        }
        expression = expression + " " + getDisplayStr(displayUnit);
    }

    if (tolerantLessThan(value, options.min)) {
        return {
            hasError: true,
            expression,
            errorMessage: `Value must be greater than ${formatValueWithUnits(
                options.min,
                options.displayUnit,
                options.displayPrecision
            )}`
        };
    } else if (tolerantGreaterThan(value, options.max)) {
        return {
            hasError: true,
            expression,
            errorMessage: `Value must be less than ${formatValueWithUnits(
                options.max,
                options.displayUnit,
                options.displayPrecision
            )}`
        };
    }

    return {
        hasError: false,
        displayExpression: formatValueWithUnits(
            value,
            displayUnit,
            displayPrecision
        ),
        expression
    };
}

export interface Result {
    hasError: false;
    /**
     * The formatted result. Includes the value rounded to the correct display precision and the display unit.
     * @example `12.00 in`
     */
    displayExpression: string;
    /**
     * The formatted expression. Essentially the raw input with clean spacing and possibly the display unit applied.
     * @example "(3.5 + 8.5) in"
     */
    expression: string;
}

export interface ErrorResult {
    hasError: true;
    /**
     * The original, unformatted expression.
     */
    expression: string;
    /**
     * An error message to display to the user.
     */
    errorMessage: string;
}

export interface EvaluateOptions {
    /**
     * The type of the expression.
     */
    quantityType: QuantityType;
    /**
     * Number of decimals to round to.
     * Should be 0 for real and integer expressions.
     */
    displayPrecision: number;
    /**
     * Unit to use in the displayExpression.
     * Should be unitless for real and integer expressions.
     */
    displayUnit: Unit;
    max: ValueWithUnits;
    min: ValueWithUnits;
}

/**
 * Evaluates a string expression.
 */
export function evaluateExpression(
    input: string,
    options: EvaluateOptions
): Result | ErrorResult {
    const quantityType = options.quantityType;

    if (input.trim().length === 0) {
        return {
            hasError: true,
            expression: input,
            errorMessage: "Enter an expression"
        };
    }

    let expr;
    let value;
    try {
        expr = parseExpression(input);
        value = evaluateExpressionValue(expr, quantityType);
    } catch (error) {
        let errorMessage;
        if (error instanceof ParseError) {
            errorMessage = error.message;
        } else {
            errorMessage = "Invalid expression";
        }
        return {
            hasError: true,
            expression: input,
            errorMessage
        };
    }

    return formatExpression(expr, value, options);
}
