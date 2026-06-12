import { assertNever } from "./assert";
import * as ast from "./ast";

export const PROGRAM_OUTPUT_VARIABLE = 0;

export type ProgramOutputType
	= typeof PROGRAM_OUTPUT_VARIABLE;

type ProgramOutputBase = {
	type: ProgramOutputType;
}

type ProgramOutputVariable = ProgramOutputBase & {
	type: typeof PROGRAM_OUTPUT_VARIABLE;
	value: ProgramValue;
};

export type ProgramOutput
	= ProgramOutputVariable;

export type ProgramResult = {
	output: ProgramOutput[];
}

export type ProgramValue = {
}

export function newProgramResult(): ProgramResult {
	return {
		output: [],
	};
}

export function interpretProgram(program: ast.Program) {
	const result = newProgramResult();

	const iter = newProgramIterator(program);

	// while (true) {
	// 	if (!stepProgram(iter)) {
	// 		break;
	// 	}
	// }

	return result;
}

type ProgramIterator = {
	program: ast.Program;
	nextStatementIdx: number;

	stack:  ast.Expression[];
	scopes: Scope[];
}

type Scope = {
	vars: Map<string, Result>;
	allowContinueBreak: boolean;
}


function newProgramIterator(program: ast.Program): ProgramIterator {
	return {
		program: program,
		nextStatementIdx: 0,
		stack: [],
		scopes: [],
	};
}

function pushScope(iter: ProgramIterator, allowContinueBreak: boolean): Scope {
	const scope: Scope = {
		vars: new Map(),
		allowContinueBreak: allowContinueBreak
	};
	iter.scopes.push(scope);
	return scope;
}

function allowsContinueOrBreak(iter: ProgramIterator): boolean {
	if (iter.scopes.length === 0) return false;
	return iter.scopes[iter.scopes.length - 1].allowContinueBreak;
}

function popScope(iter: ProgramIterator) {
	return iter.scopes.pop();
}

function getVar(iter: ProgramIterator, name: string): Result | undefined {
	for (let i = iter.scopes.length - 1; i >= 0; i--) {
		const scope = iter.scopes[i];
		const value = scope.vars.get(name)
		if (value) return value;
	}

	return undefined;
}

function setVar(iter: ProgramIterator, name: string, value: Result) {
	if (iter.scopes.length === 0) return;
	const lastScope = iter.scopes[iter.scopes.length - 1];
	lastScope.vars.set(name, value);
}

const Result_Nothing  = 0; // Also represented with 'undefined'
const Result_Number   = 1;
const Result_String   = 2;
const Result_Boolean  = 3;
const Result_Function = 4;
const Result_List     = 5;
const Result_Map      = 6;

export function typeToString(type: ResultType) {
	switch(type) {
		case Result_Nothing:  return "Nothing";
		case Result_Number:   return "Number";
		case Result_String:   return "String";
		case Result_Boolean:  return "Boolean";
		case Result_Function: return "Function";
		case Result_List:     return "List";
		case Result_Map:      return "Map";
		default: assertNever(type);
	}
}


export type ResultType =
 | typeof Result_Nothing
 | typeof Result_Number
 | typeof Result_String
 | typeof Result_Boolean
 | typeof Result_Function
 | typeof Result_List
 | typeof Result_Map
 ;

export type ResultNumber = {
	type: typeof Result_Number;
	val: number;
}

export type ResultString = {
	type: typeof Result_String;
	val: string;
}

export type ResultBoolean = {
	type: typeof Result_Boolean;
	val: boolean;
}

export type ResultFunction = {
	type: typeof Result_Function;
	val: ast.FunctionDefinition;
}

export type ResultList = {
	type: typeof Result_List;
	val: Result[];
}

export type ResultMap = {
	type: typeof Result_Map;
	val: Map<number, Result>;
}

export type ResultNothing = {
	type: typeof Result_Nothing;
}

type Result =
 | ResultNumber
 | ResultString
 | ResultBoolean
 | ResultFunction
 | ResultNothing
 | ResultList
 | ResultMap
 ;

type EvaluateError = {
	reason: string;
} | null;

function newError(reason: string): EvaluateError {
	return {
		reason: reason,
	}
}

function invalidOperatorError(op: ast.BinaryOperator, lhs: Result, rhs: Result): EvaluateError {
	return newError(`${ast.operatorToString(op.type)} is not valid for ${typeToString(lhs.type)} with ${typeToString(rhs.type)}`)
}

const NOTHING: Result = { type: Result_Nothing }
const BREAK: Result = { type: Result_Nothing }
const CONTINUE: Result = { type: Result_Nothing }


// TODO: Don't end up with this - we need an alternative formulation that lets us step through the program.
// It doesn't need to be an elaborate VM like last time - a simple control-flow graph is fine.
function evaluateExpression(expr: ast.Expression, iter: ProgramIterator): [Result, EvaluateError] {
	switch (expr.type) {
		case ast.Expression_Identifier:       return evaluateIdentifier(expr, iter);
		case ast.Expression_BinaryExpression: return evaluateBinaryOperation(expr, iter);
		case ast.Expression_FunctionCall:     return evaluateFunction(expr, iter);
		case ast.Expression_IfChain:          return evaluateIfChain(expr, iter); 
		case ast.Expression_ForLoop:          return evaluateForLoop(expr, iter);
		case ast.Expression_TypeInitializer:  return evaluateTypeInitializer(expr, iter);
		case ast.Expression_NumberLiteral:    return [{ type: Result_Number, val: expr.val }, null];
		case ast.Expression_StringLiteral:    return [{ type: Result_String, val: expr.val }, null];
		case ast.Expression_FunctionDefinition: return [{ type: Result_Function, val: expr }, null];
		case ast.Expression_Return: {
			if (!expr.expr) return [NOTHING, null];
			return evaluateExpression(expr.expr, iter);
		}
		case ast.Expression_Continue: { return [NOTHING, null]; } break;
		case ast.Expression_Break:    { return [NOTHING, null]; } break;
		default: {
			assertNever(expr);
			return [NOTHING, newError("Could not evaluate expression")];
		} break;
	}

	return [NOTHING, newError("Could not evaluate expression")];
}

function evaluateFunction(fn: ast.FunctionCall, iter: ProgramIterator): [Result, EvaluateError] {
	let result = NOTHING;
	let error: EvaluateError = null;

	pushScope(iter, false); {
		const userFn = getVar(iter, fn.name.name);
		if (userFn) {
			if (userFn.type !== Result_Function) {
				error = newError("Value was not a function - it was a " + typeToString(userFn.type));
			} else {
				[result, error] = evaluateExpressionBlock(userFn.val.body, iter);
			}
		}
	} popScope(iter);

	return [result, error]
}

function evaluateExpressionBlock(block: ast.Expression[], iter: ProgramIterator): [Result, EvaluateError] {
	const allowContinueOrBreak = allowsContinueOrBreak(iter);
	for (const expr of block) {
		if (allowContinueOrBreak) {
			if (expr.type === ast.Expression_Break) {
				return [BREAK, null];
			} else if (expr.type === ast.Expression_Continue) {
				return [CONTINUE, null];
			}
		}

		const [result, err] = evaluateExpression(expr, iter);
		if (err)                                 return [result, err];
		if (expr.type === ast.Expression_Return) return [result, err];
	}

	return [NOTHING, null]
}


function evaluateIfChain(expr: ast.IfChain, iter: ProgramIterator): [Result, EvaluateError] {
	if (expr.blocks.length === 0) return [NOTHING, newError("If chain was empty")];

	let result = NOTHING;
	let err: EvaluateError = null;

	const scope = pushScope(iter, allowsContinueOrBreak(iter)); {
		[result, err] = evaluateIfChainInternal(expr, iter, scope);
	} popScope(iter);

	return [result, err];
}

function evaluateIfChainInternal(expr: ast.IfChain, iter: ProgramIterator, scope: Scope): [Result, EvaluateError] {
	for (const branch of expr.blocks) {
		const [checkResult, err] = evaluateExpression(branch.check, iter);
		if (err)                                 return [checkResult, err];
		if (checkResult.type !== Result_Boolean) return [NOTHING, newError("If check needs to be a boolean")]

		// Epic efficiency gain strategy thing.
		scope.vars.clear();

		const [result, resultErr] = evaluateExpressionBlock(branch.block, iter); 
		if (resultErr) return [result, resultErr];
		if (result !== NOTHING) return [result, resultErr];
	}

	if (expr.else) {
		scope.vars.clear();
		return evaluateExpressionBlock(expr.else, iter);
	}

	return [NOTHING, null];
}

function evaluateBinaryOperation(expr: ast.BinaryExpression, iter: ProgramIterator): [Result, EvaluateError] {
	const [lhs, err] = evaluateExpression(expr.lhs, iter);
	if (err) return [lhs, err];

	const [rhs, err2] = evaluateExpression(expr.rhs, iter);
	if (err2) return [rhs, err2];

	if (lhs.type === Result_Number && rhs.type === Result_Number) {
		let value: ResultNumber = { type: Result_Number, val: 0 };
		switch (expr.op.type) {
			case ast.OP_ADD:      { value.val = lhs.val + rhs.val; } break;
			case ast.OP_SUBTRACT: { value.val = lhs.val - rhs.val; } break;
			case ast.OP_MULTIPLY: { value.val = lhs.val * rhs.val; } break;
			case ast.OP_DIVIDE:   { value.val = lhs.val / rhs.val; } break;

			default: return [NOTHING, invalidOperatorError(expr.op, lhs, rhs)]
		}

		if (expr.op.assignment === true) {
			if (expr.lhs.type !== ast.Expression_Identifier) {
				return [NOTHING, newError("Assignment operators only work if the left-hand-side is an identifer")];
			}

			setVar(iter, expr.lhs.name, value);

			// Fairly important that assignment evaluates to nothing. The way the code here will work is
			//  - If we have a value, then return it upwards
			//  - Otherwise, it was either a) nothing or b) assigned into a variable
			return [NOTHING, null];
		}

		return [value, null];
	}

	if (lhs.type === Result_String && rhs.type === Result_String) {
		const value: ResultString = { type: Result_String, val: "" };
		switch (expr.op.type) {
			case ast.OP_ADD:      { value.val = lhs.val + rhs.val; } break;
			default: return [NOTHING, invalidOperatorError(expr.op, lhs, rhs)]
		}

		if (expr.op.assignment === true) {
			if (expr.lhs.type !== ast.Expression_Identifier) {
				return [NOTHING, newError("Assignment operators only work if the left-hand-side is an identifer")];
			}

			setVar(iter, expr.lhs.name, value);

			return [NOTHING, null];
		}

		return [value, null]
	}

	return [NOTHING, newError(`Can't apply ${ast.operatorToString(expr.op.type)} between ${typeToString(lhs.type)} and ${typeToString(rhs.type)}`)];
}

function evaluateIdentifier(expr: ast.Identifier, iter: ProgramIterator): [Result, EvaluateError] {
	const val = getVar(iter, expr.name);
	if (!val) return [NOTHING, newError("Variable not found: " + expr.name)];
	return [val, null];
}

function evaluateForLoop(expr: ast.ForLoop, iter: ProgramIterator): [Result, EvaluateError] {
	let result = NOTHING;
	let error: EvaluateError = null;

	const scope = pushScope(iter, true); {
		[result, error] = evaluateForLoopInternal(expr, iter, scope);
	} popScope(iter);

	return [result, error];
}

function evaluateForLoopInternal(expr: ast.ForLoop, iter: ProgramIterator, scope: Scope): [Result, EvaluateError] {
	const [start, err] = evaluateExpression(expr.range.start, iter);
	if (err) return [start, err];
	if (start.type !== Result_Number) return [NOTHING, newError("For loop range start needs to be a number")];

	setVar(iter, expr.range.varName.name, start);

	outer: while (true) {
		const [end, err] = evaluateExpression(expr.range.end, iter);
		if (err) return [end, err];
		if (end.type !== Result_Number) return [NOTHING, newError("For loop range end needs to be a number")];

		switch (expr.range.rangeType) {
			case ast.RANGE_LT: {
				if (start.val >= end.val) break outer;
				start.val += 1;
			} break;
			case ast.RANGE_LTE: {
				if (start.val > end.val)  break outer;
				start.val += 1;
			} break;
			case ast.RANGE_GT: {
				if (start.val <= end.val) break outer;
				start.val -= 1;
			} break;
			case ast.RANGE_GTE: {
				if (start.val < end.val)  break outer;
				start.val -= 1;
			} break;
			default: {
				assertNever(expr.range.rangeType);
			}
		}

		const [blockResult, blockErr] = evaluateExpressionBlock(expr.statements, iter);
		if (blockErr || blockResult !== NOTHING) {
			if (blockResult === BREAK)    return [NOTHING, null];
			if (blockResult === CONTINUE) continue; // Thin minimal wrapper around continue, blazingly fast.
			return [blockResult, blockErr];
		}
	}

	return [NOTHING, null];
}

function evaluateTypeInitializer(expr: ast.TypeInitializer, iter: ProgramIterator): [Result, EvaluateError] {
	switch (expr.typename.name) {
		case "list": {
			const result: Result = { type: Result_List, val: [] };
			// for now, we'll just ignore type args. xd
			for (const arg of expr.args) {
				const [val, err] = evaluateExpression(arg, iter);
				if (err) return [val, err];
				// We'll allow empty values in the list, why not.
			}
			return [result, null];
		} break;
		case "map": {
			const result: Result = { type: Result_Map, val: new Map() };

			// for now, we'll just ignore type args. xd
			for (const arg of expr.args) {
				if (
					arg.type !== ast.Expression_BinaryExpression ||
					!arg.op.assignment || 
					arg.op.type !== ast.OP_NONE
				) {
					return [NOTHING, newError("Maps should be initialized like { key=value, key=value, etc. }")];
				} 
				
				const [key, keyErr] = evaluateExpression(arg.lhs, iter);
				if (keyErr) return [key, keyErr];
				if (!isHashable(key)) return [NOTHING, newError(`type ${typeToString(key.type)} can't be used as a map key`)];

				const [val, valErr] = evaluateExpression(arg.rhs, iter);
				if (valErr) return [val, valErr];

				result.val.set(getKey(key), val);
			}
			return [result, null];
		} break;
	}

	return [NOTHING, newError(`Don't know how to initialize this type: ${expr.typename.name}`)];
}

function isHashable(result: Result): boolean {
	switch (result.type) {
		case Result_Nothing:  return true;
		case Result_Number:   return true;
		case Result_String:   return true;
		case Result_Boolean:  return true;
	}

	return false;
}

function getKey(result: Result): any {
	switch (result.type) {
		case Result_Nothing:  return NOTHING;
		case Result_Number:   return result.val;
		case Result_String:   return result.val;
		case Result_Boolean:  return result.val;
	}
}

// function stepProgram(iter: ProgramIterator): boolean {
// 	if (iter.stack.length === 0) {
// 		const statement = iter.program.statements[iter.nextStatementIdx];
// 		iter.stack.push(statement);
// 	}
//
// 	switch (statement.type) {
// 		case ast.Expression_Identifier: {
// 			statement.type
// 		} break;
// 		case ast.Expression_BinaryExpression: {
//
// 		} break;
// 		case ast.Expression_FunctionCall: {
//
// 		} break;
// 		case ast.Expression_IfChain: {
//
// 		} break;
// 		case ast.Expression_ForLoop: {
//
// 		} break;
// 		case ast.Expression_TypeInitializer: {
//
// 		} break;
// 		case ast.Expression_NumberLiteral: {
//
// 		} break;
// 		case ast.Expression_StringLiteral: {
//
// 		} break;
// 		case ast.Expression_FunctionDefinition: {
//
// 		} break;
// 		case ast.Expression_ReturnStatement: {
//
// 		} break;
// 		case ast.Expression_Continue: {
//
// 		} break;
// 		case ast.Expression_Break: {
//
// 		} break;
// 		default: {
// 			assertNever(expr);
// 		} break;
// 	}
// }
