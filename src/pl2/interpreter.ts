import { assertNever } from "./assert";
import * as ast from "./ast";
import { newParser } from "./parser";

export type ProgramValue = {
}

export function interpretProgram(program: ast.Program): ProgramIterator {
	const iter = newProgramIterator(program);

	// The root scope will never get popped.
	pushScope(iter, 0); 
 
	for (const expr of program.statements) {
		const [val, err] = evaluateExpression(expr, iter);
		if (err || val !== NOTHING) break;
	}

	// while (true) {
	// 	if (!stepProgram(iter)) {
	// 		break;
	// 	}
	// }

	return iter;
}

export function interpretCode(code: string): ProgramIterator {
	const parser = newParser(code);
	const program = ast.parseProgram(parser);
	const result = interpretProgram(program);
	return result;
}

export function interpretCodeLines(lines: string[]): ProgramIterator {
	return interpretCode(lines.join("\n"))
}

type ProgramIterator = {
	program: ast.Program;
	nextStatementIdx: number;

	stack:  ast.Expression[];
	scopes: Scope[];
}

type Scope = {
	vars: Map<string, Result>;
	flags: number;
}

const SCOPE_ALLOW_CONTINUE_BREAK = 1 << 0;
const SCOPE_ISOLATED             = 1 << 1;

const SCOPE_NON_ISOLATED_FLAGS = SCOPE_ALLOW_CONTINUE_BREAK;

export function newProgramIterator(program: ast.Program): ProgramIterator {
	return {
		program: program,
		nextStatementIdx: 0,
		stack: [],
		scopes: [],
	};
}

export function pushScope(iter: ProgramIterator, flags: number): Scope {
	const scope: Scope = {
		vars: new Map(),
		flags: flags,
	};
	iter.scopes.push(scope);
	return scope;
}

export function currentScopeNonIsolatedFlags(iter: ProgramIterator): number {
	if (iter.scopes.length === 0) return 0;
	return iter.scopes[iter.scopes.length - 1].flags & SCOPE_NON_ISOLATED_FLAGS;
}

export function popScope(iter: ProgramIterator) {
	return iter.scopes.pop();
}

export function getVar(iter: ProgramIterator, name: string): Result | undefined {
	for (let i = iter.scopes.length - 1; i >= 0; i--) {
		const scope = iter.scopes[i];
		const value = scope.vars.get(name)
		if (value) return value;
	}

	return undefined;
}

export function setVar(iter: ProgramIterator, name: string, value: Result) {
	if (iter.scopes.length === 0) return;

	let scope: Scope | undefined;
	for (let i = iter.scopes.length - 1; i >= 0; i--) {
		const iScope = iter.scopes[i];
		if (iScope.vars.has(name)) {
			scope = iScope;
			break;
		}

		if (iScope.flags & SCOPE_ISOLATED) {
			break;
		}
	}

	if (!scope) {
		scope = iter.scopes[iter.scopes.length - 1];
	}

	scope.vars.set(name, value);
}

export const Result_Nothing  = 0; // Also represented with 'undefined'
export const Result_Number   = 1;
export const Result_String   = 2;
export const Result_Boolean  = 3;
export const Result_Function = 4;
export const Result_List     = 5;
export const Result_Map      = 6;

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

export type Result =
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

export function newError(reason: string): EvaluateError {
	return {
		reason: reason,
	}
}

export function newNumber(val: number): ResultNumber {
	return {
		type: Result_Number,
		val: val,
	};
}

export function newBoolean(val: boolean): ResultBoolean {
	return {
		type: Result_Boolean,
		val:  val,
	};
}

export function invalidOperatorError(opType: ast.BinaryOperatorType, lhs: Result, rhs: Result): EvaluateError {
	return newError(`${ast.operatorToString(opType)} is not valid for ${typeToString(lhs.type)} with ${typeToString(rhs.type)}`)
}

const NOTHING: Result = { type: Result_Nothing }
const BREAK: Result = { type: Result_Nothing }
const CONTINUE: Result = { type: Result_Nothing }


// TODO: Don't end up with this - we need an alternative formulation that lets us step through the program.
// It doesn't need to be an elaborate VM like last time - a simple control-flow graph is fine.
export function evaluateExpression(expr: ast.Expression, iter: ProgramIterator): [Result, EvaluateError] {
	switch (expr.type) {
		case ast.Expression_Identifier:       return evaluateIdentifier(expr, iter);
		case ast.Expression_BinaryExpression: return evaluateBinaryOperation(expr, iter);
		case ast.Expression_FunctionCall:     return evaluateFunctionCall(expr, iter);
		case ast.Expression_IfChain:          return evaluateIfChain(expr, iter); 
		case ast.Expression_ForLoop:          return evaluateForLoop(expr, iter);
		case ast.Expression_TypeInitializer:  return evaluateTypeInitializer(expr, iter);
		case ast.Expression_NumberLiteral:    return [{ type: Result_Number, val: expr.val }, null];
		case ast.Expression_StringLiteral:    return [{ type: Result_String, val: expr.val }, null];
		case ast.Expression_BooleanLiteral:   return [{ type: Result_Boolean, val: expr.val }, null];
		case ast.Expression_FunctionDefinition: return [{ type: Result_Function, val: expr }, null];
		case ast.Expression_Return: {
			if (!expr.expr) return [NOTHING, null];
			return evaluateExpression(expr.expr, iter);
		}
		case ast.Expression_Continue: { return [NOTHING, null]; } break;
		case ast.Expression_Break:    { return [NOTHING, null]; } break;
		case ast.Expression_ReturnBlock: {
			let result;
			pushScope(iter, 0); {
				result = evaluateExpressionBlock(expr.block, iter);
			} popScope(iter);
			return result;
		}
		default: {
			assertNever(expr);
			return [NOTHING, newError("Could not evaluate expression")];
		} break;
	}

	return [NOTHING, newError("Could not evaluate expression")];
}

export function evaluateCode(code: string, iter: ProgramIterator): [Result, EvaluateError] {
	const expr = ast.parseExpressionFromText(code);
	if (!expr) return [NOTHING, newError("Couldn't parse the expression")];
	
	return evaluateExpression(expr, iter);
}

function evaluateFunctionCall(fn: ast.FunctionCall, iter: ProgramIterator): [Result, EvaluateError] {
	let result = NOTHING;
	let error: EvaluateError = null;

	pushScope(iter, SCOPE_ISOLATED); {
		[result, error] = evaluateFunctionCallInternal(fn, iter);
	} popScope(iter);

	return [result, error]
}

function evaluateFunctionCallInternal(fn: ast.FunctionCall, iter: ProgramIterator): [Result, EvaluateError] {
	const functionName = fn.name.name;
	const userFn = getVar(iter, functionName);
	if (userFn) {
		if (userFn.type !== Result_Function) return [NOTHING, newError("Value was not a function - it was a " + typeToString(userFn.type))];

		const wantedNumArgs = userFn.val.args.length;
		const gotNumArgs    = fn.arguments.length;
		if (wantedNumArgs !== gotNumArgs) {
			return [
				NOTHING,
				newError(`Wanted ${wantedNumArgs} arguments for function ${fn.name.name}, got ${gotNumArgs} arguments instead`)
			];
		}

		for (let i = 0; i < userFn.val.args.length; i++) {
			const argName = userFn.val.args[i].name.name;

			// TODO: argument types, type validation

			const argExpr = fn.arguments[i];
			const [argVal, err] = evaluateExpression(argExpr, iter);
			if (err) return [argVal, err];

			setVar(iter, argName, argVal);
		}

		return evaluateExpressionBlock(userFn.val.body, iter);
	}

	return [NOTHING, newError(`Couldn't find function ${functionName} in this scope`)];
}

function evaluateExpressionBlock(block: ast.Expression[], iter: ProgramIterator): [Result, EvaluateError] {
	const scopeFlags = currentScopeNonIsolatedFlags(iter);
	for (const expr of block) {
		if (scopeFlags & SCOPE_ALLOW_CONTINUE_BREAK) {
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

	const scope = pushScope(iter, currentScopeNonIsolatedFlags(iter)); {
		[result, err] = evaluateIfChainInternal(expr, iter, scope);
	} popScope(iter);

	return [result, err];
}

function evaluateIfChainInternal(expr: ast.IfChain, iter: ProgramIterator, scope: Scope): [Result, EvaluateError] {
	for (const branch of expr.blocks) {
		const [checkResult, err] = evaluateExpression(branch.check, iter);
		if (err)                                 return [checkResult, err];
		if (checkResult.type !== Result_Boolean) return [NOTHING, newError("If check needs to be a boolean")]
		if (checkResult.val === true) {
			return evaluateExpressionBlock(branch.block, iter); 
		}
	}

	if (expr.else) {
		scope.vars.clear();
		return evaluateExpressionBlock(expr.else, iter);
	}

	return [NOTHING, null];
}

function evaluateBinaryOperation(expr: ast.BinaryExpression, iter: ProgramIterator): [Result, EvaluateError] {
	let value = NOTHING;
	let err: EvaluateError = null;

	[value, err] = evaluateExpression(expr.rhs, iter);
	if (err) return [value, err];

	if (expr.op.type !== ast.OP_NONE) {
		const [lhs, err2] = evaluateExpression(expr.lhs, iter);
		if (err2) return [lhs, err2];

		let err: EvaluateError = null;
		[value, err] = evaluateBinaryOperationOnResults(lhs, expr.op.type, value);
		if (err) return [value, err];
	}

	if (expr.op.assignment) {
		if (expr.lhs.type !== ast.Expression_Identifier) {
			return [NOTHING, newError(`Can't assign to ${ast.expressionToString(expr)}`)];
		}

		setVar(iter, expr.lhs.name, value);
		return [NOTHING, null];
	} 

	return [value, null];
}

function evaluateBinaryOperationOnResults(lhs: Result, exprOp: ast.BinaryOperatorType, rhs: Result): [Result, EvaluateError] {
	if (lhs.type === Result_Number && rhs.type === Result_Number) {
		switch (exprOp) {
			case ast.OP_ADD:         return [newNumber(lhs.val + rhs.val), null];
			case ast.OP_SUBTRACT:    return [newNumber(lhs.val - rhs.val), null];
			case ast.OP_MULTIPLY:    return [newNumber(lhs.val * rhs.val), null];
			case ast.OP_DIVIDE:      return [newNumber(lhs.val / rhs.val), null];
			case ast.OP_BITWISE_AND: return [newNumber(lhs.val & rhs.val), null];
			case ast.OP_BITWISE_OR:  return [newNumber(lhs.val | rhs.val), null];
			case ast.OP_BITWISE_XOR: return [newNumber(lhs.val ^ rhs.val), null];
			case ast.OP_LESS_THAN:       return [newBoolean(lhs.val < rhs.val), null];
			case ast.OP_LESS_THAN_EQ:    return [newBoolean(lhs.val <= rhs.val), null];
			case ast.OP_GREATER_THAN:    return [newBoolean(lhs.val > rhs.val), null];
			case ast.OP_GREATER_THAN_EQ: return [newBoolean(lhs.val >= rhs.val), null];
			case ast.OP_EQ:              return [newBoolean(lhs.val == rhs.val), null];
			case ast.OP_NOT_EQ:          return [newBoolean(lhs.val != rhs.val), null];
			default: return [NOTHING, invalidOperatorError(exprOp, lhs, rhs)]
		}
	}

	if (lhs.type === Result_Boolean && rhs.type === Result_Boolean) {
		switch (exprOp) {
			case ast.OP_LOGICAL_AND: return [newBoolean(lhs.val && rhs.val), null];
			case ast.OP_LOGICAL_OR:  return [newBoolean(lhs.val || rhs.val), null];
			case ast.OP_LOGICAL_XOR: return [newBoolean(lhs.val != rhs.val), null];
			default: return [NOTHING, invalidOperatorError(exprOp, lhs, rhs)]
		}
	}

	if (lhs.type === Result_String && rhs.type === Result_String) {
		const value: ResultString = { type: Result_String, val: "" };
		switch (exprOp) {
			case ast.OP_ADD: { value.val = lhs.val + rhs.val; } break;
			default: return [NOTHING, invalidOperatorError(exprOp, lhs, rhs)]
		}

		return [value, null]
	}

	return [NOTHING, newError(`Can't apply ${ast.operatorToString(exprOp)} between ${typeToString(lhs.type)} and ${typeToString(rhs.type)}`)];
}

function evaluateIdentifier(expr: ast.Identifier, iter: ProgramIterator): [Result, EvaluateError] {
	const val = getVar(iter, expr.name);
	if (!val) return [NOTHING, newError("Variable not found: " + expr.name)];
	return [val, null];
}

function evaluateForLoop(expr: ast.ForLoop, iter: ProgramIterator): [Result, EvaluateError] {
	let result = NOTHING;
	let error: EvaluateError = null;

	const scope = pushScope(iter, SCOPE_ALLOW_CONTINUE_BREAK); {
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

export function isHashable(result: Result): boolean {
	switch (result.type) {
		case Result_Nothing:  return true;
		case Result_Number:   return true;
		case Result_String:   return true;
		case Result_Boolean:  return true;
	}

	return false;
}

export function getKey(result: Result): any {
	switch (result.type) {
		case Result_Nothing:  return NOTHING;
		case Result_Number:   return result.val;
		case Result_String:   return result.val;
		case Result_Boolean:  return result.val;
	}
}
