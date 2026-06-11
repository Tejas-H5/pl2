import { assert } from "./assert";
import {advance, advanceBy, advanceToNextNewLine, compareCurrent, currentChar, newParser, Parser, parserPos, reachedEnd } from "./parser";
import { isDigit, isLetter, isWhitespace } from "./string-utils";
import { TextPosition } from "./text-pos";

export type Program = {
	statements: Expression[];
}

export const OP_NONE     = 0;
export const OP_ADD      = 1;
export const OP_SUBTRACT = 2;
export const OP_MULTIPLY = 3;
export const OP_DIVIDE   = 4;

export type BinaryOperatorType =
 | typeof OP_NONE
 | typeof OP_ADD
 | typeof OP_SUBTRACT
 | typeof OP_MULTIPLY
 | typeof OP_DIVIDE
 ;

export function operatorToString(op: number): string {
	switch(op) {
		case OP_ADD:      return "+";
		case OP_SUBTRACT: return "-";
		case OP_MULTIPLY: return "*";
		case OP_DIVIDE:   return "/";
	}
	return "?";
}

export type BinaryOperator = {
	type: BinaryOperatorType;
	assignment: boolean;
}

export const Expression_Invalid            = 0;
export const Expression_Identifier         = 1;
export const Expression_BinaryExpression   = 2;
export const Expression_FunctionCall       = 3;
export const Expression_IfChain            = 4;
export const Expression_ForLoop            = 5;
export const Expression_TypeInitializer    = 6;
export const Expression_NumberLiteral      = 7;
export const Expression_StringLiteral      = 8;
export const Expression_FunctionDefinition = 9;
export const Expression_Return             = 10;
export const Expression_Continue           = 11;
export const Expression_Break              = 12;

export type ExpressionType =
 | typeof Expression_Invalid
 | typeof Expression_Identifier
 | typeof Expression_BinaryExpression
 | typeof Expression_FunctionCall
 | typeof Expression_ForLoop
 | typeof Expression_TypeInitializer
 | typeof Expression_NumberLiteral
 | typeof Expression_FunctionDefinition
 | typeof Expression_Return
 | typeof Expression_Continue
 | typeof Expression_Break
 ;

export type ExpressionBase = {
	type: number;
	start: TextPosition;
	end:   TextPosition;
}

export type BinaryExpression = ExpressionBase & {
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
	varName:   Identifier;
	start:     Expression;
	end:       Expression;
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

export type FunctionArgument = {
	name: Identifier;
	// TODO: type: TypeExpression. I was originally thinking of just leaving everything untyped.
	// The interesting thing here, is that I wanted to just have x = map<string, number>{}
	// and omit the ability to do x: map<string, number> = {}. Right? 
	// But function arguments need to be done like x: map<string, number>, so in order
	// to be truly consistent, I'll need to do x: map<string, number> = {} and x: map<string, number>, etc. everywhere.
}

export type FunctionDefinition = ExpressionBase & {
	type: typeof Expression_FunctionDefinition;
	args: FunctionArgument[];
	body: Expression[];
}

export type ReturnStatement = ExpressionBase & {
	type: typeof Expression_Return;
	expr: Expression | undefined;
}

export type LoopControlFlowLabel = ExpressionBase &  {
	type: 
		| typeof Expression_Continue
		| typeof Expression_Break;
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
 | FunctionDefinition
 | ReturnStatement
 | LoopControlFlowLabel
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

export function parseOperatorInternal(parser: Parser): BinaryOperatorType {
	if (compareCurrent(parser, "+")) { advanceBy(parser, 1); return OP_ADD; }
	if (compareCurrent(parser, "-")) { advanceBy(parser, 1); return OP_SUBTRACT; }
	if (compareCurrent(parser, "*")) { advanceBy(parser, 1); return OP_MULTIPLY; }
	if (compareCurrent(parser, "/")) { advanceBy(parser, 1); return OP_DIVIDE; }
	return OP_NONE;
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

export function parseGroup(parser: Parser): Expression | undefined {
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

function compareCurrentAndAdvance(parser: Parser, keyword: string): boolean {
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

export function parseIfChain(parser: Parser): IfChain | undefined {
	if (!compareCurrentAndAdvance(parser, "if ")) return;

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
		if (!compareCurrentAndAdvance(parser, "else ")) {
			break;
		}

		// Parse the if of the next statement.
		parseWhitespace(parser);
		if (!compareCurrentAndAdvance(parser, "if ")) {
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

export function parseForLoop(parser: Parser): ForLoop | undefined {
	const pos = parserPos(parser);

	if (!compareCurrentAndAdvance(parser, "for ")) return;

	parseWhitespace(parser)
	const varName = parseIdentifier(parser);
	if (!varName) {
		// TODO: error
		return undefined;
	}

	parseWhitespace(parser)
	if (!compareCurrentAndAdvance(parser, "in ")) {
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
	if (compareCurrentAndAdvance(parser, "..<=")) {
		rangeType = RANGE_LTE;
	} else if (compareCurrentAndAdvance(parser, "..<")) {
		rangeType = RANGE_LT;
	} else if (compareCurrentAndAdvance(parser, "..>=")) {
		rangeType = RANGE_GTE;
	} else if (compareCurrentAndAdvance(parser, "..>")) {
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
			start:   initial,
			end:    target,
			rangeType: rangeType,
		},
		statements: block,
	};
}

export function parseSingularExpression(parser: Parser): Expression | undefined {
	parseWhitespace(parser);

	if (compareCurrent(parser, "("))    return parseGroup(parser);
	if (compareCurrent(parser, "if "))  return parseIfChain(parser);
	if (compareCurrent(parser, "for ")) return parseForLoop(parser)
	if (compareCurrent(parser, "fn("))  return parseFunctionDefinition(parser)

	if (compareCurrentAndAdvance(parser, "return ")) {
		// TODO: error reporting. return is like return() here. I couldn't figure out how else to make it work without semicolons.
		return undefined;
	}
	if (compareCurrent(parser, "return(")) return parseReturnStatement(parser);
	if (canParseNumberLiteral(parser)) return parseNumberLiteral(parser);
	if (currentChar(parser) === "\"")  return parseStringLiteral(parser);

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

export function parseReturnStatement(parser: Parser): ReturnStatement | undefined {
	if (!compareCurrentAndAdvance(parser, "return(")) return undefined;

	parseWhitespace(parser);

	const pos = parserPos(parser);

	const expr = parseExpression(parser);
	if (expr) {
		parseWhitespace(parser);
	}

	if (currentChar(parser) !== ")") {
		// TODO: error reporting
		return undefined;
	}
	advance(parser);

	return {
		type: Expression_Return,
		expr: expr,
		start: pos,
		end: parserPos(parser),
	};
}

export function parseBinaryExpression(parser: Parser, lhs: Expression, level: number, op: BinaryOperator | undefined): BinaryExpression | undefined {
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
			op = undefined;
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

export function parseExpression(parser: Parser): Expression | undefined {
	let expr = parseSingularExpression(parser);
	if (!expr) return undefined;

	const binExpr = parseBinaryExpression(parser, expr, 0, undefined);
	if (binExpr) return binExpr;

	return expr;
}


export function getOpLevel(op: BinaryOperatorType): number {
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

export function parseFunctionCall(parser: Parser, functionName: Identifier): FunctionCall | undefined {
	if (currentChar(parser) !== "(") return;

	if (!advance(parser)) return;

	const args: Expression[] = [];

	let foundClosingParen = false;
	while(true) {
		parseWhitespace(parser);
		if (currentChar(parser) === ")") {
			advance(parser);
			foundClosingParen = true;
			break;
		}

		const expr = parseExpression(parser);
		if (!expr) {
			// TODO: report error
			return undefined;
		}

		args.push(expr);

		parseWhitespace(parser);
		if (currentChar(parser) !== "," && currentChar(parser) !== ")") {
			// TODO: report error - expected comma.
			return undefined;
		}

		if (currentChar(parser) === ",") {
			advance(parser);
			parseWhitespace(parser);
		}
	}

	if (!foundClosingParen) {
		// TODO: report this error
		return undefined;
	}

	return {
		type: Expression_FunctionCall,
		start: functionName.start,
		end:   parserPos(parser),
		name: functionName,
		arguments: args,
	};
}

export function parseTypeInitializer(
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

export function parseTypeArgs(parser: Parser): Identifier[] | undefined {
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

export function parseNumberLiteral(parser: Parser): NumberLiteral | undefined {
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

export function computeNumberForNumberExpression(expr: NumberLiteral): number {
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
export function parseStringLiteral(parser: Parser): StringLiteral | undefined {
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

export function computeStringForStringLiteral(fullText: string): [string | undefined, string] {
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

export function parseFunctionDefinition(parser: Parser): FunctionDefinition | undefined {
	parseWhitespace(parser);
	const pos = parserPos(parser);

	if (!compareCurrentAndAdvance(parser, "fn(")) return;

	parseWhitespace(parser);

	const args: FunctionArgument[] = [];

	let foundClosingParen = false;
	while (true) {
		parseWhitespace(parser);
		if (currentChar(parser) === ")") {
			advance(parser);
			foundClosingParen = true;
			break;
		}

		const ident = parseIdentifier(parser);
		if (!ident) {
			// TODO: report error
			return undefined;
		}

		args.push({ name: ident });

		parseWhitespace(parser);
		if (currentChar(parser) !== "," && currentChar(parser) !== ")") {
			// TODO: report error - expected comma.
			return undefined;
		}

		if (currentChar(parser) === ",") {
			advance(parser);
			parseWhitespace(parser);
		}
	}

	if (!foundClosingParen) {
		// TODO: report error
		return undefined;
	}

	parseWhitespace(parser);
	const body = parseCodeBlock(parser);
	if (!body) {
		// TODO: report error
		return undefined;
	}

	return {
		type: Expression_FunctionDefinition,
		start: pos,
		end: parserPos(parser),
		args: args,
		body: body,
	};
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

export function parseProgramFromText(code: string) {
	const parser = newParser(code);
	return parseProgram(parser);
}

export function parseExpressionFromText(text: string) {
	const parser = newParser(text);
	return parseExpression(parser);
}

