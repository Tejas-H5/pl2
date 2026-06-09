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

const Expression_Invalid           = 0;
const Expression_Identifier        = 1;
const Expression_BinaryExpression  = 2;
const Expression_FunctionCall      = 3;
const Expression_IfChain           = 4;
const Expression_ForLoop           = 5;
const Expression_TypeInitializer   = 6;
const Expression_NumberLiteral     = 7;
const Expression_StringLiteral     = 8;

export type ExpressionType =
 | typeof Expression_Invalid
 | typeof Expression_Identifier
 | typeof Expression_BinaryExpression
 | typeof Expression_FunctionCall
 | typeof Expression_ForLoop
 | typeof Expression_TypeInitializer
 | typeof Expression_NumberLiteral
 ;

export type ExpressionBase = {
	type: number;
	start: TextPosition;
	end:   TextPosition;
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
	else: Expression[] | undefined;
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

export type TypeInitializer = ExpressionBase & {
	type: typeof Expression_TypeInitializer;
	typename: Identifier;
	typeArgs: Identifier[] | undefined; 
	args: Expression[];
}


export type NumberLiteral = ExpressionBase & {
    type: typeof Expression_NumberLiteral;
    integerPart: string;
    decimalPart: string | undefined;
    exponentPart: string | undefined;
    isNegative: boolean;
    val: number;
}

export type StringLiteral = ExpressionBase & {
    type: typeof Expression_StringLiteral;
    val: string;
}

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

export type DataType = {
}

export type Expression = 
 | BinaryExpression
 | Identifier
 | FunctionCall
 | IfChain
 | ForLoop
 | TypeInitializer
 | NumberLiteral
 | StringLiteral
 ;

export function expressionToString(text: string, expr: Expression): string {
    return text.slice(expr.start.i, expr.end.i)
}

export function isAllowedIdentifierSymbol(char: string) {
    return isLetter(char) || isDigit(char) || char === "_";
}

export function canParseNumberLiteral(r: Parser): boolean {
    const c = currentChar(r);
    return c === "+" || c === "-" || isDigit(c);
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

	if (!isLetter(currentChar(parser))) return;

	const start = parserPos(parser);

    while (isAllowedIdentifierSymbol(currentChar(parser)) && advance(parser)) {}

	if (start.i === parser.pos.i) {
		return undefined;
	}

    const name = parser.text.slice(start.i, parser.pos.i);

    return {
		type: Expression_Identifier,
		start: start,
		end:   parserPos(parser),
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
		if (!advance(parser)) return;
	}

	if (op === 0 && !assignment) return undefined;

	return {
		type: op,
		assignment: assignment,
	};
}

addTestGroup("Operator parsing", [parseOperator], () => {
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

	if (!advance(parser)) return;

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

	const start = parserPos(parser);
	const blocks: { check: Expression; block: Expression[]; }[] = [];
	let elseItems: Expression[] | undefined;

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
		blocks.push({ check, block });

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

			elseItems = elseBlock;

			break;
		}
	}

	return {
		type: Expression_IfChain,
		start: start,
		end:   parserPos(parser),
		blocks,
		else: elseItems,
	};
}

addTestGroup("If-chains", [parseIfChain], () => {
	addTest("Single if", r => {
		const expr = parseExpressionFromText(`if a { b c d }`)
		testAssert(r, !!expr);
		testAssert(r, expr.type === Expression_IfChain);
		testEqual(r, expr.else, undefined);
		testEqual(r, expr.blocks.length, 1);
		testEqual(r, expr.blocks[0].block.length, 3);
	})

	addTest("If-else", r => {
		const expr = parseExpressionFromText(`if a { b c d } else { f g }`)
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === Expression_IfChain, "1");
		testEqual(r, expr.else!.length, 2);
		testEqual(r, expr.blocks.length, 1);
		testEqual(r, expr.blocks[0].block.length, 3);
	})

	addTest("If-else-if", r => {
		const expr = parseExpressionFromText(`if a { b c d } else if b { f g } else { h }`)
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === Expression_IfChain, "1");
		testEqual(r, expr.else!.length, 1);
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
		start: pos,
		end:   parserPos(parser),
		range: {
			varName:   varName,
			initial:   initial,
			target:    target,
			rangeType: rangeType,
		},
		statements: block,
	};
}

addTestGroup("For loops", [parseForLoop], () => {
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

	const group = parseGroup(parser);
	if (group) return group;
	reset(parser, pos);

	const ifBlock = parseIfChain(parser);
	if (ifBlock) return ifBlock;
	reset(parser, pos);

	const forLoop = parseForLoop(parser);
	if (forLoop) return forLoop;
	reset(parser, pos);

	if (canParseNumberLiteral(parser)) {
		const number = parseNumberLiteral(parser);
		if (number) return number;

		// TODO: error here
		return undefined;
	}

	if (currentChar(parser) === "\"") {
		const str = parseStringLiteral(parser);
		if (str) return str;

		// TODO: error here
		return undefined;
	}

	// Identifier, or function, or data initializer. Do this _after_ keywords.
	if (isLetter(currentChar(parser))) {
		const identifier = parseIdentifier(parser);
		assert(!!identifier);

		// No whitespace parsing here. fn(x) to work, fn (x) to not work.

		let typeArgs: Identifier[] | undefined;
		if (currentChar(parser) === "<") {
			typeArgs = parseTypeArgs(parser);
		}

		// TODO: template functions?
		if (currentChar(parser) === "(") {
			const functionCall = parseFunctionCall(parser, identifier);
			if (functionCall) {
				return functionCall;
			}

			return undefined;
		} else if (currentChar(parser) === "{") {
			const dataInitializer = parseTypeInitializer(parser, identifier, typeArgs);
			if (dataInitializer) {
				return dataInitializer;
			}

			return undefined;
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
				start: lhs.start,
				end: rhs.end,
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
			start: expr.start,
			end: rhs.end,
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

addTestGroup("Binary expressions", [parseExpression, parseBinaryExpression], () => {
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
	if (currentChar(parser) !== "(") return;

	if (!advance(parser)) return;

	const args: Expression[] = [];

	while(true) {
		const expr = parseExpression(parser);
		if (expr) {
			args.push(expr);
			parseWhitespace(parser);
			if (currentChar(parser) === ",") {
				if (!advance(parser)) return;
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
		start: functionName.start,
		end:   parserPos(parser),
		name: functionName,
		arguments: args,
	};
}

addTestGroup("Function call arguments", [parseFunctionCall], () => {
	addTest("no args", r => {
		const expr = parseExpressionFromText("a()");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall);
		testEqual(r, expr.name.name, "a");
	})

	addTest("one arg", r => {
		const expr = parseExpressionFromText("a(y)");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall);
		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 1);
		testEqual(r, expr.arguments[0].type, Expression_Identifier);
		testEqual(r, (expr.arguments[0] as Identifier).name, "y");
	})

	addTest("two args", r => {
		const expr = parseExpressionFromText("a(x, y)");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_FunctionCall);
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
		testAssert(r, expr.type === Expression_FunctionCall);

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

function parseTypeInitializer(
	parser: Parser,
	identifier: Identifier,
	typeArgs: Identifier[] | undefined
): TypeInitializer | undefined {
	if (currentChar(parser) !== "{") return;

	const pos = parserPos(parser);
	
	advance(parser);

	const args: Expression[] = [];

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
		if (currentChar(parser) !== "}") {
			// TODO: report this error
			return undefined;
		}

		advance(parser);
		break;
	}

	return {
		type: Expression_TypeInitializer,
		start: pos,
		end:   parserPos(parser),
		typename: identifier,
		args: args,
		typeArgs: typeArgs,
	};
}

function parseTypeArgs(parser: Parser): Identifier[] | undefined {
	if (currentChar(parser) !== "<") return;
	advance(parser);

	const args: Identifier[] = [];

	while(true) {
		const ident = parseIdentifier(parser);
		if (ident) {
			args.push(ident);
			parseWhitespace(parser);
			if (currentChar(parser) === ",") {
				advance(parser);
			}
			continue;
		} 

		parseWhitespace(parser);
		if (currentChar(parser) !== ">") {
			// TODO: report this error
			return undefined;
		}

		advance(parser);
		break;
	}

	return args;
}

addTestGroup("Type initializers", [parseTypeArgs, parseTypeInitializer], () => {
	addTest("List", r => {
		const expr = parseExpressionFromText("list<f32>{a, a, a, a}");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === Expression_TypeInitializer);
		testAssert(r, !!expr.typeArgs);
		test(r, isIdentifier(expr.typeArgs[0], "f32"));
		testEqual(r, expr.typename.name, "list");
		testEqual(r, expr.args.length, 4);
	})

	addTest("Map", r => {
		const expr = parseExpressionFromText("map<string, f32>{a=b,c=d,e=f}");
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === Expression_TypeInitializer, "1");

		testAssert(r, !!expr.typeArgs);
		testEqual(r, expr.typeArgs.length, 2);
		testEqual(r, expr.typeArgs[0].name, "string");
		testEqual(r, expr.typeArgs[1].name, "f32");

		testEqual(r, expr.typename.name, "map");
		testEqual(r, expr.args.length, 3);
	})
});

function parseNumberLiteral(parser: Parser): NumberLiteral | undefined {
    const pos = parserPos(parser);

    let isNegative = false;
    if (currentChar(parser) === "+") {
        advance(parser);
    } else if (currentChar(parser) === "-") {
        isNegative = true;
        advance(parser);
    }

    const intStart = parser.pos.i;
    while (isValidNumberPart(currentChar(parser)) && advance(parser)) {}

    const integerPart = parser.text.slice(intStart, parser.pos.i);

    const result: NumberLiteral = {
        type: Expression_NumberLiteral,
		start: pos,
		end:   parserPos(parser),
        integerPart,
        decimalPart: undefined,
        exponentPart: undefined,
        isNegative,
        val: 0,
    };

    if (
        currentChar(parser) === "."
        // Here specifically because we need to make sure numbers don't collide with ..< and ..<= operators
        && currentChar(parser, 1) !== "."
        && advance(parser)
    ) {
        const decimalPartStart = parser.pos.i;
        while (isValidNumberPart(currentChar(parser)) && advance(parser)) { }
        result.decimalPart = parser.text.slice(decimalPartStart, parser.pos.i);
        result.end = parserPos(parser);
    }

	if (result.integerPart === "" && result.decimalPart === undefined) {
		return undefined;
	}

    if (currentChar(parser) === "e" && advance(parser)) {
        const c = currentChar(parser);

		let exponentPartStart = parser.pos.i;
        if (c === "+" || c === "-") {
			if (c === "-") {
				exponentPartStart = parser.pos.i;
			} else {
				exponentPartStart = parser.pos.i + 1;
			}

            if (!advance(parser)) {
                return result;
            }
        }

        while (isValidNumberPart(currentChar(parser)) && advance(parser)) { }
        result.exponentPart = parser.text.slice(exponentPartStart, parser.pos.i);
        result.end = parserPos(parser);
    }

    result.val = computeNumberForNumberExpression(result);

    return result;
}

addTestGroup("Number parsing", [parseNumberLiteral, computeNumberForNumberExpression], () => {
	addTest("Zero", r => {
		const expr = parseExpressionFromText("0.00");
		testAssert(r, expr?.type === Expression_NumberLiteral);
		testEqual(r, expr.isNegative, false);
		testEqual(r, expr.val, 0);
		testEqual(r, expr.integerPart, "0");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, undefined)
	});

	addTest("One_e_2", r => {
		const expr = parseExpressionFromText("1.00e2");
		testAssert(r, expr?.type === Expression_NumberLiteral);
		testEqual(r, expr.isNegative, false);
		testEqual(r, expr.val, 100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("+One_e_2", r => {
		const expr = parseExpressionFromText("+1.00e2");
		testAssert(r, expr?.type === Expression_NumberLiteral);
		testEqual(r, expr.isNegative, false);
		testEqual(r, expr.val, 100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("-One_e_2", r => {
		const expr = parseExpressionFromText("-1.00e2");
		testAssert(r, expr?.type === Expression_NumberLiteral);
		testEqual(r, expr.isNegative, true);
		testEqual(r, expr.val, -100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("-One-e_+2", r => {
		const expr = parseExpressionFromText("-1.00e+2");
		testAssert(r, expr?.type === Expression_NumberLiteral);
		testEqual(r, expr.isNegative, true);
		testEqual(r, expr.val, -100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("-One-e_-2", r => {
		const expr = parseExpressionFromText("-1.00e-2");
		testAssert(r, expr?.type === Expression_NumberLiteral);
		testEqual(r, expr.isNegative, true);
		testEqual(r, expr.val, -0.01);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "-2");
	});

	addTest("0 - -1", r => {
		const expr = parseExpressionFromText("0 - -1");
		testAssert(r, expr?.type === Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, 0);

		testAssert(r, expr.rhs.type === Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, -1);
	});

	addTest("0 - +1", r => {
		const expr = parseExpressionFromText("0 - +1");
		testAssert(r, expr?.type === Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, 0);

		testAssert(r, expr.rhs.type === Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, 1);
	});

	addTest("-1 - +0", r => {
		const expr = parseExpressionFromText("-1 - +0");
		testAssert(r, expr?.type === Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, -1);

		testAssert(r, expr.rhs.type === Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, 0);
	});

	addTest("+1 - +0", r => {
		const expr = parseExpressionFromText("+1 - +0");
		testAssert(r, expr?.type === Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, 1);

		testAssert(r, expr.rhs.type === Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, 0);
	});

	addTest("+ -1", r => {
		const expr = parseExpressionFromText("+ -1");
		testEqual(r, expr, undefined);
	});

	addTest("- -1", r => {
		const expr = parseExpressionFromText("- -1");
		testEqual(r, expr, undefined);
	});
});

function computeNumberForNumberExpression(expr: NumberLiteral): number {
    let result = 0;

    if (expr.decimalPart) {
        const text = expr.decimalPart.replace(/_/g, "");
        const decimalVal = parseInt(text) / Math.pow(10, text.length)
        result += decimalVal;
    }

    if (expr.integerPart) {
        const text = expr.integerPart.replace(/_/g, "");
        const intVal = parseInt(text);
        result += intVal;
    }

    if (expr.exponentPart) {
        const text = expr.exponentPart.replace(/_/g, "");
        const expVal = parseInt(text);
        result *= Math.pow(10, expVal);
    }

    if (expr.isNegative) {
        result = -result;
    }

    // TODO: return undefined if the literal is impossible to generate properly

    return result;
}

// TODO: This is a very basic string literal that could be vastly improved. current problems include:
// - opening a " connects directly to the start of another string. JavaScript ` has this problem as well, lmao.
// - I want the indentation in a string to be relative to the current indentation of the code, not to the
//      start of the line. Something like the Java """ strings would be good here
// - need some form of interpolation, since that is always nice to have.
function parseStringLiteral(parser: Parser): StringLiteral | undefined {
	if (currentChar(parser) !== "\"") return;

    const startPos = parserPos(parser);

    let closed = false;
    while (!reachedEnd(parser)) {
        advance(parser);

        const c = currentChar(parser);
        if (c === "\\") {
            advance(parser);
        } else if (c === "\"") {
            closed = true;
            advance(parser);
            break;
        }
    }

    // There's a good chance we'll go off the edge of the document when 
    // we've opened up a string literal. It's best we just reset to the end of the
    // line we started on, so we can still parse the rest of the stuff correctly (hopefully);

    if (!closed) {
        parser.pos = startPos;
        advanceToNextNewLine(parser);
        return;
    }

    const result: StringLiteral = {
		type: Expression_StringLiteral,
        start: startPos,
        end: parserPos(parser),
        val: "",
    };

    const [val, error] = computeStringForStringLiteral(
        expressionToString(parser.text, result)
    );
    if (val === undefined) {
        // TODO: addErrorAtCurrentPosition(parser, error);
        return;
    }

    result.val = val;
    return result;
}

function computeStringForStringLiteral(fullText: string): [string | undefined, string] {
    const text = fullText.slice(1, fullText.length - 1);
    const sb = [];

    let isEscape = false;
    let errorMessage = "";
    for (const c of text) {
        if (!isEscape) {
            if (c === "\\") {
                isEscape = true;
                continue;
            }

            sb.push(c);
        } else {
            isEscape = false;
            switch (c) {
                case "\"":
                    sb.push("\"");
                    break;
                case "n":
                    sb.push("\n");
                    break;
                case "r":
                    sb.push("\r");
                    break;
                case "b":
                    sb.push("\b");
                    break;
                case "t":
                    sb.push("\t");
                    break;
                case "\\":
                    sb.push("\\");
                    break;
                default:
                    errorMessage = "Invalid escape sequence \\" + c;
                    break;
            }
        }
    }

    if (errorMessage) {
        return [undefined, errorMessage]
    }

    const result = sb.join("");
    return [result, ""];
}
addTestGroup("String parsing", [parseStringLiteral, computeStringForStringLiteral], () => {
	addTest("Normal string", r => {
		const expr = parseExpressionFromText(`"hi"`);
		testAssert(r, expr?.type === Expression_StringLiteral);
		testEqual(r, expr.val, "hi")
	});
});

addTestGroup("String parsing", [parseStringLiteral, computeStringForStringLiteral], () => {
	addTest("Normal string", r => {
		const expr = parseExpressionFromText(`"hi"`);
		testAssert(r, expr?.type === Expression_StringLiteral);
		testEqual(r, expr.val, "hi")
	});

	addTest("Empty string", r => {
		const expr = parseExpressionFromText(`""`);
		testAssert(r, expr?.type === Expression_StringLiteral);
		testEqual(r, expr.val, "")
	});

	addTest("Escape sequence - backslash", r => {
		const expr = parseExpressionFromText(`"\\\\"`);
		testAssert(r, expr?.type === Expression_StringLiteral);
		testEqual(r, expr.val, "\\")
	});

	addTest("Escape sequence - quote", r => {
		const expr = parseExpressionFromText(`"\\""`);
		testAssert(r, expr?.type === Expression_StringLiteral);
		testEqual(r, expr.val, "\"")
	});

	addTest("Whitespace", r => {
		const expr = parseExpressionFromText(`"    "`);
		testAssert(r, expr?.type === Expression_StringLiteral);
		testEqual(r, expr.val, "    ")
	});
})

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

addTestGroup("parseProgram", [parseProgram], () => {
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

