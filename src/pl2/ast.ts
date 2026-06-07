import { addTest, addTestGroup, testAssert, testDeepEqual, testEqual } from "src/testing/testing";
import { assert } from "./assert";
import {
	advance,
	advanceBy,
	advanceToNextNewLine,
	compareCurrent,
	currentChar,
	newParser,
	Parser,
	parserPos,
	reachedEnd,
} from "./parser";
import { isDigit, isLetter, isWhitespace } from "./string-utils";
import { TextPosition } from "./text-pos";

export type Program = {
	statements: Expression[];
}

const OP_INVALID  = 0;
const OP_ADD      = 1;
const OP_SUBTRACT = 2;
const OP_MULTIPLY = 3;
const OP_DIVIDE   = 4;

export type BinaryOperatorType =
 | typeof OP_INVALID
 | typeof OP_ADD
 | typeof OP_SUBTRACT
 | typeof OP_MULTIPLY
 | typeof OP_DIVIDE
 ;

export type BinaryOperator = {
	type: BinaryOperatorType;
	assignment: boolean;
}

const EXPR_INVALID    = 0;
const EXPR_IDENTIFIER = 1;
const EXPR_BINARY     = 2;

export type ExpressionType =
 | typeof EXPR_INVALID
 | typeof EXPR_IDENTIFIER
 | typeof EXPR_BINARY
 ;

export type ExpressionBase = {
	type: number;
	pos:  TextPosition;
}

type BinaryExpression = ExpressionBase & {
	type: typeof EXPR_BINARY;
	lhs: Expression;
	op:  BinaryOperator;
	rhs: Expression;
}

export type Identifier = ExpressionBase & {
	type: typeof EXPR_IDENTIFIER;
	name: string;
}

export type Expression = 
	| BinaryExpression
	| Identifier
	;

export function isAllowedIdentifierSymbol(char: string) {
    return isLetter(char) || isDigit(char) || char === "_";
}

export function canParseNumberLiteral(r: Parser) {
    const c = currentChar(r);
    return c === "+" || isDigit(c);
}

export function isValidNumberPart(c: string) {
    return isDigit(c) || c === "_";
}

export function parseWhitespace(parser: Parser) {
    while (!reachedEnd(parser)) {
        const c = currentChar(parser);
        if (isWhitespace(c)) {
            advance(parser);
            continue;
        }

        // Comments can be considered whitespace.
        if (compareCurrent(parser, "//")) {
            advanceToNextNewLine(parser);
            advance(parser);
            continue;
        }

        break;
    }
}

export function parseIdentifier(parser: Parser): Identifier | undefined {
	parseWhitespace(parser);

	const start = parserPos(parser);

    assert(isLetter(currentChar(parser)));
    while (isAllowedIdentifierSymbol(currentChar(parser))) {
		advance(parser)
	}

	if (start.i === parser.pos.i) {
		return undefined;
	}

    const name = parser.text.slice(start.i, parser.pos.i);

    return {
		type: EXPR_IDENTIFIER,
		pos: start,
        name,
    };
}

addTest("Identifier", r => {
	const expr = parseExpressionFromText(` henlo `);
	testAssert(r, !!expr, "!!expr");
	testAssert(r, expr.type === EXPR_IDENTIFIER, "expr.type === EXPR_IDENTIFIER");
	testEqual(r, expr.name, "henlo");
});

export function parseOperatorInternal(parser: Parser): [BinaryOperatorType, number] {
	if (compareCurrent(parser, "+")) return [OP_ADD,      1];
	if (compareCurrent(parser, "-")) return [OP_SUBTRACT, 1];
	if (compareCurrent(parser, "*")) return [OP_MULTIPLY, 1];
	if (compareCurrent(parser, "/")) return [OP_DIVIDE,   1];

	return [0, 0];
}

export function parseOperator(parser: Parser): BinaryOperator | undefined {
	parseWhitespace(parser);

	const [op, len] = parseOperatorInternal(parser);
	advanceBy(parser, len);

	let assignment = false;
	if (currentChar(parser) === "=") {
		assignment = true;
		advance(parser);
	}

	if (op === 0 && !assignment) return undefined;

	return {
		type: op,
		assignment: assignment,
	};
}

addTestGroup("Assignment, Operators", () => {
	addTest("Normal", r => {
		const expr = parseExpressionFromText(`x = y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === EXPR_BINARY, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: 0, assignment: true });
		testAssert(r, expr.lhs.type === EXPR_IDENTIFIER, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === EXPR_IDENTIFIER, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Increment", r => {
		const expr = parseExpressionFromText(`x += y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === EXPR_BINARY, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: OP_ADD, assignment: true });
		testAssert(r, expr.lhs.type === EXPR_IDENTIFIER, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === EXPR_IDENTIFIER, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Add", r => {
		const expr = parseExpressionFromText(`x + y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === EXPR_BINARY, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: OP_ADD, assignment: false });
		testAssert(r, expr.lhs.type === EXPR_IDENTIFIER, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === EXPR_IDENTIFIER, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Invalid operator", r => {
		const parser = newParser("x")
		const result = parseOperator(parser);
		testEqual(r, result, undefined);
	});
})

function parseExpression(parser: Parser): Expression | undefined {
	parseWhitespace(parser);

	const pos = parserPos(parser);

	const c = currentChar(parser);

	if (isAllowedIdentifierSymbol(c)) {
		const identifier = parseIdentifier(parser);
		assert(!!identifier);

		parseWhitespace(parser);

		// This is optional
		const op = parseOperator(parser);
		if (op) {
			const rhs = parseExpression(parser);
			if (rhs) {
				return {
					type: EXPR_BINARY,
					pos:  pos,
					lhs:  identifier,
					op:   op,
					rhs:  rhs,
				};
			}
		}

		return identifier;
	}

	return undefined;
}

export function parseProgram(parser: Parser): Program {
	const program: Program = {
		statements: [],
	};

	while (true) {
		const expr = parseExpression(parser);
		if (!expr) break;

		program.statements.push(expr);
	}

	return program;
}

addTestGroup("parseProgram", () => {
	addTest("Parse a line", r => {
		const program = parseProgramFromText(`x = y`);
		testEqual(r, program.statements.length, 1);
	});

	addTest("Parse two lines", r => {
		// May want to disallow this somehow, but the parser can still handle it. 
		const program = parseProgramFromText(`x = y y = z`);
		testEqual(r, program.statements.length, 2);
	});

	addTest("Parse two lines, different line", r => {
		const program = parseProgramFromText(`x = y\ny = z`);
		testEqual(r, program.statements.length, 2);
	});
});

export function parseProgramFromText(code: string) {
	const parser = newParser(code);
	return parseProgram(parser);
}

export function parseExpressionFromText(text: string) {
	const parser = newParser(text);
	return parseExpression(parser);
}

