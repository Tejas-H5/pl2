import { addTest, addTestGroup, test, testAssert, testDeepEqual, testEqual } from "src/testing/testing";
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
    reset,
} from "./parser";
import { isDigit, isLetter, isWhitespace } from "./string-utils";
import { newTextPosition, TextPosition } from "./text-pos";

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

const Expression_Invalid           = 0;
const Expression_Identifier        = 1;
const Expression_BinaryExpression  = 2;
const Expression_FunctionCall      = 3;
const Expression_IfChain           = 4;
const Expression_ForLoop           = 5;

export type ExpressionType =
 | typeof Expression_Invalid
 | typeof Expression_Identifier
 | typeof Expression_BinaryExpression
 | typeof Expression_FunctionCall
 | typeof Expression_ForLoop
 ;

export type ExpressionBase = {
	type: number;
	pos:  TextPosition;
}

type BinaryExpression = ExpressionBase & {
	type: typeof Expression_BinaryExpression;
	lhs: Expression;
	op:  BinaryOperator;
	rhs: Expression;
}

export type Identifier = ExpressionBase & {
	type: typeof Expression_Identifier;
	name: string;
}

export type FunctionCall = ExpressionBase & {
	type:      typeof Expression_FunctionCall;
	name:      Identifier;
	arguments: Expression[];
}

export type IfChain = ExpressionBase & {
	type: typeof Expression_IfChain;
	blocks: {
		check: Expression;
		block: Expression[];
	}[];
	else: Expression[];
};

export type ForLoop = ExpressionBase & {
	type: typeof Expression_ForLoop;
	range: ForLoopRange;
	statements: Expression[];
}

export type ForLoopRange = {
	varName: Identifier;
	initial: Expression;
	target: Expression;
	rangeType: ForLoopRangeType;
};

export const RANGE_LT  = 1;
export const RANGE_LTE = 2;
export const RANGE_GT  = 3;
export const RANGE_GTE = 4;

export type ForLoopRangeType = 
 | typeof RANGE_LT
 | typeof RANGE_LTE
 | typeof RANGE_GT
 | typeof RANGE_GTE
 ;


export type Expression = 
 | BinaryExpression
 | Identifier
 | FunctionCall
 | IfChain
 | ForLoop
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
		type: Expression_Identifier,
		pos: start,
        name,
    };
}

addTest("Identifier", r => {
	const expr = parseExpressionFromText(` henlo `);
	testAssert(r, !!expr, "!!expr");
	testAssert(r, expr.type === Expression_Identifier, "expr.type === EXPR_IDENTIFIER");
	testEqual(r, expr.name, "henlo");
});

export function parseOperatorInternal(parser: Parser): BinaryOperatorType {
	if (compareCurrent(parser, "+")) { advanceBy(parser, 1); return OP_ADD; }
	if (compareCurrent(parser, "-")) { advanceBy(parser, 1); return OP_SUBTRACT; }
	if (compareCurrent(parser, "*")) { advanceBy(parser, 1); return OP_MULTIPLY; }
	if (compareCurrent(parser, "/")) { advanceBy(parser, 1); return OP_DIVIDE; }
	return OP_INVALID;
}

export function parseOperator(parser: Parser): BinaryOperator | undefined {
	parseWhitespace(parser);

	const op = parseOperatorInternal(parser);

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
		testAssert(r, expr.type === Expression_BinaryExpression, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: 0, assignment: true });
		testAssert(r, expr.lhs.type === Expression_Identifier, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === Expression_Identifier, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Increment", r => {
		const expr = parseExpressionFromText(`x += y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_BinaryExpression, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: OP_ADD, assignment: true });
		testAssert(r, expr.lhs.type === Expression_Identifier, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === Expression_Identifier, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Add", r => {
		const expr = parseExpressionFromText(`x + y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_BinaryExpression, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: OP_ADD, assignment: false });
		testAssert(r, expr.lhs.type === Expression_Identifier, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === Expression_Identifier, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Invalid operator", r => {
		const parser = newParser("x")
		const result = parseOperator(parser);
		testEqual(r, result, undefined);
	});
})

function parseGroup(parser: Parser): Expression | undefined {
	if (currentChar(parser) !== "(") return;

	advance(parser);
	const expr = parseExpression(parser);
	if (!expr) {
		// TODO: report error
		return undefined;
	}

	parseWhitespace(parser);
	if (currentChar(parser) !== ")") {
		// TODO: report error - expected closing brace here. i
		// return what we have anyway
	}
	advance(parser);

	return expr;
}

addTest("Groups", r => {
	const expr = parseExpressionFromText("a * (b + c)");
	testAssert(r, !!expr, "0")
	testAssert(r, expr.type === Expression_BinaryExpression);
	test(r, isIdentifier(expr.lhs, "a"))

	testAssert(r, expr.rhs.type === Expression_BinaryExpression);
	test(r, isIdentifier(expr.rhs.lhs, "b"))
	test(r, isIdentifier(expr.rhs.rhs, "c"))
});

function checkForKeyword(parser: Parser, keyword: string): boolean {
	if (!compareCurrent(parser, keyword)) return false;
	advanceBy(parser, keyword.length);
	return true;
}

function parseCodeBlock(parser: Parser): Expression[] | undefined {
	if (currentChar(parser) !== "{") {
		// TODO: report error 
		return undefined;
	}
	advance(parser);

	const statements: Expression[] = [];
	let foundBlockEnd = false;
	while (true) {
		parseWhitespace(parser);
		if (currentChar(parser) === "}") {
			foundBlockEnd = true;
			break;
		}

		const expr = parseExpression(parser);
		if (!expr) break;

		statements.push(expr);
	}

	if (!foundBlockEnd) {
		// Report error
		return;
	}

	advance(parser);

	return statements;
}

function parseIfChain(parser: Parser): IfChain | undefined {
	if (!checkForKeyword(parser, "if ")) return;

	parseWhitespace(parser);
	const result: IfChain = {
		pos: parserPos(parser),
		type: Expression_IfChain,
		blocks: [],
		else: [],
	};

	while (true) {
		const check = parseExpression(parser);
		if (!check) {
			// TODO: error - expected check
			return undefined;
		}

		parseWhitespace(parser);

		const block = parseCodeBlock(parser);
		if (!block) {
			// TODO: Wrap the error?
			return undefined;
		}
		result.blocks.push({ check, block });

		parseWhitespace(parser);
		if (!checkForKeyword(parser, "else ")) {
			break;
		}

		// Parse the if of the next statement.
		parseWhitespace(parser);
		if (!checkForKeyword(parser, "if ")) {
			// Final block doesn't have an if, but it does have an else.
			
			const elseBlock = parseCodeBlock(parser);
			if (!elseBlock) {
				// TODO: wrap error
				break;
			}

			result.else = elseBlock;

			break;
		}
	}

	return result;
}

addTestGroup("If-chains", () => {
	addTest("Single if", r => {
		const expr = parseExpressionFromText(`if a { b c d }`)
		testAssert(r, !!expr);
		testAssert(r, expr.type === Expression_IfChain);
		testEqual(r, expr.else.length, 0);
		testEqual(r, expr.blocks.length, 1);
		testEqual(r, expr.blocks[0].block.length, 3);
	})

	addTest("If-else", r => {
		const expr = parseExpressionFromText(`if a { b c d } else { f g }`)
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === Expression_IfChain, "1");
		testEqual(r, expr.else.length, 2);
		testEqual(r, expr.blocks.length, 1);
		testEqual(r, expr.blocks[0].block.length, 3);
	})

	addTest("If-else-if", r => {
		const expr = parseExpressionFromText(`if a { b c d } else if b { f g } else { h }`)
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === Expression_IfChain, "1");
		testEqual(r, expr.else.length, 1);
		testEqual(r, expr.blocks.length, 2);
		testEqual(r, expr.blocks[0].block.length, 3);
		testEqual(r, expr.blocks[1].block.length, 2);
	})
});

function parseForLoop(parser: Parser): ForLoop | undefined {
	const pos = parserPos(parser);

	if (!checkForKeyword(parser, "for ")) return;

	parseWhitespace(parser)
	const varName = parseIdentifier(parser);
	if (!varName) {
		// TODO: error
		return undefined;
	}

	parseWhitespace(parser)
	if (!checkForKeyword(parser, "in ")) {
		// TODO: error
		return undefined;
	}

	const initial = parseExpression(parser);
	if (!initial) {
		// TODO: error
		return undefined;
	}

	parseWhitespace(parser);

	let rangeType: ForLoopRangeType;
	if (checkForKeyword(parser, "..<=")) {
		rangeType = RANGE_LTE;
	} else if (checkForKeyword(parser, "..<")) {
		rangeType = RANGE_LT;
	} else if (checkForKeyword(parser, "..>=")) {
		rangeType = RANGE_GTE;
	} else if (checkForKeyword(parser, "..>")) {
		rangeType = RANGE_GT;
	} else {
		// ERROR
		return undefined;
	}

	parseWhitespace(parser);

	const target = parseExpression(parser);
	if (!target) {
		// TODO: error
		return undefined;
	}

	parseWhitespace(parser);
	const block = parseCodeBlock(parser);
	if (!block) {
		// TODO: error
		return undefined;
	}

	return {
		type: Expression_ForLoop,
		pos: pos,
		range: {
			varName:   varName,
			initial:   initial,
			target:    target,
			rangeType: rangeType,
		},
		statements: block,
	};
}

addTestGroup("For loops", () => {
	addTest("lte", r => {
		const expr = parseExpressionFromText("for i in a..<b {}");
		testAssert(r, !!expr, "0")
		testAssert(r, expr.type === Expression_ForLoop, "1")
		testEqual(r, expr.range.rangeType, RANGE_LT);
	});
	addTest("lte", r => {
		const expr = parseExpressionFromText("for i in a..>=b {}");
		testAssert(r, !!expr, "0")
		testAssert(r, expr.type === Expression_ForLoop, "1")
		testEqual(r, expr.range.rangeType, RANGE_GTE);
	});
})

function parseSingularExpression(parser: Parser): Expression | undefined {
	parseWhitespace(parser);

	const pos = parserPos(parser);

	// Parse a group. 
	const group = parseGroup(parser);
	if (group) return group;
	reset(parser, pos);

	// Parse if-block
	const ifBlock = parseIfChain(parser);
	if (ifBlock) return ifBlock;
	reset(parser, pos);

	const forLoop = parseForLoop(parser);
	if (forLoop) return forLoop;
	reset(parser, pos);

	// Identifier, or function. Do this _after_ keywords.
	if (isAllowedIdentifierSymbol(currentChar(parser))) {
		const identifier = parseIdentifier(parser);
		assert(!!identifier);

		// No whitespace parsing here. fn(x) to work, fn (x) to not work.

		if (currentChar(parser) === "(") {
			const functionCall = parseFunctionCall(parser, identifier);
			if (functionCall) {
				return functionCall;
			}
		}

		return identifier;
	}

	return undefined;
}

function max(a: number, b: number) {
	if (a > b) return a;
	return b;
}

function parseBinaryExpression(parser: Parser, lhs: Expression, level: number, op: BinaryOperator | undefined): BinaryExpression | undefined {
	let expr: BinaryExpression | undefined;

	while (true) {
		parseWhitespace(parser);

		if (!op) {
			op = parseOperator(parser);
			if (!op) {
				break;
			}
		}

		parseWhitespace(parser);

		if (!expr) {
			const rhs = parseSingularExpression(parser);
			if (!rhs) {
				// TODO: report expected expression here error
				break;
			}

			expr = {
				type: Expression_BinaryExpression,
				pos: lhs.pos,
				lhs: lhs,
				op: op,
				rhs: rhs,
			}
			level = getOpLevel(op.type);
			op = undefined;
			continue;
		}

		const opLevel = getOpLevel(op.type);
		if (opLevel > level) {
			// lhs <op> (rhs recursive thing)
			const newRhs = parseBinaryExpression(parser, expr.rhs, opLevel, op);
			if (!newRhs) break;

			expr.rhs = newRhs;
			continue;
		}

		const rhs = parseSingularExpression(parser);
		if (!rhs) {
			// TODO: report expected expression here error
			break;
		}

		// We may have moved from a higher level to a lower level, which is ok for this codepath.
		level = opLevel;

		// (lhs recursive thing) <op> rhs
		expr = {
			type: Expression_BinaryExpression,
			pos: expr.pos,
			lhs: expr,
			op: op,
			rhs: rhs,
		}
		op = undefined;
	}

	return expr;
}

function parseExpression(parser: Parser): Expression | undefined {
	let expr = parseSingularExpression(parser);
	if (!expr) return undefined;

	const binExpr = parseBinaryExpression(parser, expr, 0, undefined);
	if (binExpr) return binExpr;

	return expr;
}


function getOpLevel(op: BinaryOperatorType): number {
	// The binary-expression tree has levels defined by operators.
	//
	// e.g: a + b + c * d * e + f
	//
	// The actuall tree is more like:
	//
	// a + b +           + f
	//         c * d * e
	//
	// Things at lower levels must be concatinated before things at higher levels.
	// The concept is the same as precedence, but it's easier to think about imo.

    switch (op) {
		case OP_ADD:      return 1;
		case OP_SUBTRACT: return 1;
		case OP_MULTIPLY: return 2;
		case OP_DIVIDE:   return 2;
    }
	return 0;
}

function isIdentifier(expr: Expression | undefined, name: string): expr is Identifier {
	if (!expr) return false;
	if (expr.type !== Expression_Identifier) return false;
	return expr.name === name;
}

addTestGroup("Binary expressions", () => {
	addTest("add", r => {
		const expr = parseExpressionFromText("a + b");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_BinaryExpression);
		test(r, isIdentifier(expr.lhs, "a"))
		test(r, isIdentifier(expr.rhs, "b"))
	});

	addTest("add chain", r => {
		const expr = parseExpressionFromText("a + b + c");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_BinaryExpression);
		testAssert(r, expr.lhs.type === Expression_BinaryExpression);
		test(r, isIdentifier(expr.lhs.lhs, "a"))
		test(r, isIdentifier(expr.lhs.rhs, "b"))
		test(r, isIdentifier(expr.rhs, "c"))
	});

	addTest("precedence parsing", r => {
		const expr = parseExpressionFromText("a * b + c * d");
		testAssert(r, !!expr, "!!expr");

		testAssert(r, expr.type === Expression_BinaryExpression, "0");
		testAssert(r, expr.lhs.type === Expression_BinaryExpression, "1");
		testAssert(r, expr.rhs.type === Expression_BinaryExpression, "2");

		test(r, isIdentifier(expr.lhs.lhs, "a"))
		test(r, isIdentifier(expr.lhs.rhs, "b"))

		test(r, isIdentifier(expr.rhs.lhs, "c"))
		test(r, isIdentifier(expr.rhs.rhs, "d"))
	});

	addTest("precedence parsing 2", r => {
		// NOTE: multiple correct solutions exist...
		const expr = parseExpressionFromText("a + b * c + d");
		testAssert(r, !!expr, "!!expr");

		testAssert(r, expr.type === Expression_BinaryExpression, "0");
		test(r, isIdentifier(expr.lhs, "a"))
		testAssert(r, expr.rhs.type === Expression_BinaryExpression, "1");

		test(r, isIdentifier(expr.rhs.rhs, "d"))
		testAssert(r, expr.rhs.lhs.type === Expression_BinaryExpression, "2");

		test(r, isIdentifier(expr.rhs.lhs.lhs, "b"))
		test(r, isIdentifier(expr.rhs.lhs.rhs, "c"))
	});
});

function parseFunctionCall(parser: Parser, functionName: Identifier): FunctionCall | undefined {
	const args: Expression[] = [];

	advance(parser);
	while(true) {
		const expr = parseExpression(parser);
		if (expr) {
			args.push(expr);
			parseWhitespace(parser);
			if (currentChar(parser) === ",") {
				advance(parser);
			}
			continue;
		} 

		parseWhitespace(parser);
		if (currentChar(parser) !== ")") {
			// TODO: report this error
			return undefined;
		}

		advance(parser);
		break;
	}

	return {
		type: Expression_FunctionCall,
		pos:  functionName.pos,
		name: functionName,
		arguments: args,
	};
}

addTestGroup("Function call arguments", () => {
	addTest("no args", r => {
		const expr = parseExpressionFromText("a()");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall, "expr.type === EXPR_FN_CALL");
		testEqual(r, expr.name.name, "a");
	})

	addTest("one arg", r => {
		const expr = parseExpressionFromText("a(y)");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall, "expr.type === EXPR_FN_CALL");
		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 1);
		testEqual(r, expr.arguments[0].type, Expression_Identifier);
		testEqual(r, (expr.arguments[0] as Identifier).name, "y");
	})

	addTest("two args", r => {
		const expr = parseExpressionFromText("a(x, y)");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall, "expr.type === EXPR_FN_CALL");
		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 2);
		testEqual(r, expr.arguments[0].type, Expression_Identifier);
		testEqual(r, (expr.arguments[0] as Identifier).name, "x");
		testEqual(r, expr.arguments[1].type, Expression_Identifier);
		testEqual(r, (expr.arguments[1] as Identifier).name, "y");
	})

	addTest("nested calls", r => {
		const expr = parseExpressionFromText("a(b(c()))");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall, "expr.type === EXPR_FN_CALL");

		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 1);
		testEqual(r, expr.arguments[0].type, Expression_FunctionCall);

		const bFn = (expr.arguments[0] as FunctionCall);
		testEqual(r, bFn.name.name, "b");
		testEqual(r, bFn.arguments.length, 1);

		const cFn = (bFn.arguments[0] as FunctionCall);
		testEqual(r, cFn.name.name, "c");
		testEqual(r, cFn.arguments.length, 0);
	})
});

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

