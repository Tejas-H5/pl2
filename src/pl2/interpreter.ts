import { assert, assertNever } from "./assert";
import * as ast from "./ast";
import { getBuiltinFn } from "./builtins";
import { newParser } from "./parser";

export function interpretProgram(program: ast.Program): ProgramIterator {
	const iter = newProgramIterator(program);

	// The root scope will never get popped.
	pushScope(iter, 0); 

	for (const expr of program.statements) {
		const dst = newSlot();
		if (evaluateExpression(expr, iter, dst) !== RETURN_NONE) {
			break;
		}
	}

	assert(iter.scopes.length === 1);

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

export type ProgramIterator = {
	program: ast.Program;
	nextStatementIdx: number;

	stack:  ast.Expression[];
	scopes: Scope[];

	logs: LogEntry[];

	temp1: Slot;
	temp2: Slot;
	temp3: Slot;
	temp4: Slot;
	temp5: Slot;
	temp6: Slot;
}

export type LogEntry = {
	expr: ast.Expression;
	text: string;
}

export type Scope = {
	vars: Map<string, Slot>;
	flags: number;
}

export const SCOPE_ALLOW_CONTINUE_BREAK = 1 << 0;
export const SCOPE_ISOLATED             = 1 << 1;
export const SCOPE_HIDDEN               = 1 << 2; 
export const SCOPE_NON_ISOLATED_FLAGS = SCOPE_ALLOW_CONTINUE_BREAK;

export function newProgramIterator(program: ast.Program): ProgramIterator {
	return {
		program: program,
		nextStatementIdx: 0,
		stack:  [],
		scopes: [],
		logs:   [],
		temp1: newSlot(),
		temp2: newSlot(),
		temp3: newSlot(),
		temp4: newSlot(),
		temp5: newSlot(),
		temp6: newSlot(),
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

export function getCurrentScope(iter: ProgramIterator): Scope {
	assert(iter.scopes.length > 0);
	return iter.scopes[iter.scopes.length - 1];
}

export function popScope(iter: ProgramIterator) {
	return iter.scopes.pop();
}

export function getVar(iter: ProgramIterator, name: string): Result | undefined {
	if (iter.scopes.length === 0) return undefined;

	for (let i = iter.scopes.length - 1; i > 0; i--) {
		const scope = iter.scopes[i];
		if (scope.flags & SCOPE_HIDDEN) {
			continue;
		}

		const value = scope.vars.get(name)
		if (value) {
			return value.result;
		}

		if (scope.flags & SCOPE_ISOLATED) {
			break;
		}
	}

	// Also search the global scope - it's available to every other scope
	{
		const value = iter.scopes[0].vars.get(name);
		if (value) {
			return value.result;
		}
	}

	return undefined;
}

const NIL_SLOT = newSlot();

export function setOrCreateVar(iter: ProgramIterator, name: string): Slot {
	if (iter.scopes.length === 0) return NIL_SLOT;

	let scopeToUse: Scope | undefined;
	for (let i = iter.scopes.length - 1; i >= 0; i--) {
		const scope = iter.scopes[i];
		if (scope.flags & SCOPE_HIDDEN) {
			continue;
		}

		if (scope.vars.has(name)) {
			scopeToUse = scope;
			break;
		}

		if (scope.flags & SCOPE_ISOLATED) {
			break;
		}
	}

	if (!scopeToUse) {
		scopeToUse = iter.scopes[iter.scopes.length - 1];
	}

	const slot = newSlot();
	scopeToUse.vars.set(name, slot);

	return slot;
}

export function createVar(iter: ProgramIterator, name: string): Slot {
	const scope = getCurrentScope(iter);
	const slot = newSlot();
	scope.vars.set(name, slot);
	return slot;
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

type ResultBase = { type: number; val: unknown; }

export type ResultNumber = ResultBase & {
	type: typeof Result_Number;
	val: number;
}

export type ResultString = ResultBase & {
	type: typeof Result_String;
	val: string;
}

export type ResultBoolean = ResultBase & {
	type: typeof Result_Boolean;
	val: boolean;
}

export type ResultFunction = ResultBase & {
	type: typeof Result_Function;
	val: ast.FunctionDefinition;
}

export type ResultList = ResultBase & {
	type: typeof Result_List;
	val: Result[];
}


export type ValidMapKey = number | string | object | boolean;

export type ResultMap = ResultBase & {
	type: typeof Result_Map;
	val: Map<ValidMapKey, { key: Result, val: Result }>;
}

export type ResultNothing = ResultBase & {
	type: typeof Result_Nothing;
	val: undefined,
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

export type Slot = {
	result: Result;
	error:  string | undefined;
};

// Try to keep these to a minimum.
export function newSlot(): Slot {
	return {
		result: NOTHING,
		error: undefined,
	};
}

export function cloneResult(src: Result): Result {
	return { type: src.type, val: src.val } as Result;
}

export function setError(dst: Slot, reason: string | undefined): typeof RETURN_ERR {
	dst.error = reason;
	return RETURN_ERR;
}

export function setResultNumber(dst: Slot, val: number): typeof RETURN_VAL {
	dst.result = newNumber(val);
	return RETURN_VAL;
}

export function setResultBoolean(dst: Slot, val: boolean): typeof RETURN_VAL {
	dst.result = newBoolean(val);
	return RETURN_VAL;
}

export function setResultString(dst: Slot, val: string): typeof RETURN_VAL {
	dst.result = newString(val);
	return RETURN_VAL;
}

export function setResult(dst: Slot, val: Result): typeof RETURN_VAL {
	dst.result = val;
	return RETURN_VAL;
}

export function newNumber(val: number): ResultNumber {
	return {type: Result_Number, val: val,};
}

export function newBoolean(val: boolean): ResultBoolean {
	return {type: Result_Boolean, val:  val,};
}

export function newString(val: string): ResultString {
	return {type: Result_String, val:  val,};
}

export function invalidOperatorError(opType: ast.BinaryOperatorType, lhs: Result, rhs: Result): string {
	return `${ast.operatorToString(opType)} is not valid for ${typeToString(lhs.type)} with ${typeToString(rhs.type)}`;
}

// NOTE: compared by reference. You can't just construct the same object and expect it to work
export const NOTHING:  ResultNothing = { type: Result_Nothing, val: undefined }
export const BREAK:    ResultNothing = { type: Result_Nothing, val: undefined }
export const CONTINUE: ResultNothing = { type: Result_Nothing, val: undefined }

export const RETURN_NONE  = 0;
export const RETURN_VAL = 1;
export const RETURN_ERR = 2;

export type ExprReturn = 
 | typeof RETURN_NONE
 | typeof RETURN_VAL
 | typeof RETURN_ERR
 ;

export type ExprValueReturn = 
 | typeof RETURN_VAL
 | typeof RETURN_ERR;

export type ExprNoReturn = 
 | typeof RETURN_NONE
 | typeof RETURN_ERR;


// TODO: Don't end up with this - we need an alternative formulation that lets us step through the program.
// It doesn't need to be an elaborate VM like last time - a simple control-flow graph is fine.
export function evaluateExpression(expr: ast.Expression, iter: ProgramIterator, dst: Slot): ExprReturn {
	switch (expr.type) {
		case ast.Expression_Identifier:         return evaluateIdentifier(expr, iter, dst);
		case ast.Expression_Indexer:            return evaluateIndexer(expr, iter, dst);
		case ast.Expression_BinaryExpression:   return evaluateBinaryOperation(expr, iter, dst);
		case ast.Expression_FunctionCall:       return evaluateFunctionCall(expr, iter, dst);
		case ast.Expression_IfChain:            return evaluateIfChain(expr, iter, dst); 
		case ast.Expression_ForLoop:            return evaluateForLoop(expr, iter, dst);
		case ast.Expression_TypeInitializer:    return evaluateTypeInitializer(expr, iter, dst);
		case ast.Expression_NumberLiteral:      return setResultNumber(dst, expr.val);
		case ast.Expression_StringLiteral:      return setResultString(dst, expr.val);
		case ast.Expression_BooleanLiteral:     return setResultBoolean(dst, expr.val);
		case ast.Expression_FunctionDefinition: return setResult(dst, { type: Result_Function, val: expr });
		case ast.Expression_Return: {
			if (!expr.expr) return setResult(dst, NOTHING);
			return evaluateExpression(expr.expr, iter, dst);
		}
		case ast.Expression_Continue: return RETURN_VAL;
		case ast.Expression_Break:    return RETURN_VAL;
		case ast.Expression_ReturnBlock: {
			let result;
			pushScope(iter, 0); {
				result = evaluateExpressionBlock(expr.block, iter, dst);
			} popScope(iter);
			return result;
		}
		default: {
			assertNever(expr);
			return setError(dst, "Could not evaluate expression");
		} break;
	}
}

export function evaluateExpressionValue(expr: ast.Expression, iter: ProgramIterator, dst: Slot): ExprValueReturn {
	const rt = evaluateExpression(expr, iter, dst);
	if (rt === RETURN_ERR)  return RETURN_ERR;
	if (rt === RETURN_NONE) return setError(dst, "Expected an expression that results in a value here");
	return rt;
}

export function evaluateCode(code: string, iter: ProgramIterator): [Result, string | undefined] {
	const expr = ast.parseExpressionFromText(code);
	if (!expr) return [NOTHING, "Couldn't parse the expression"];
	
	const slot = newSlot();
	evaluateExpression(expr, iter, slot);
	return [slot.result, slot.error];
}

function evaluateFunctionCall(fn: ast.FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	let rt: ExprReturn = RETURN_NONE;

	// Needs to be hidden. When we create new variables in this scope
	pushScope(iter, SCOPE_HIDDEN); {
		rt = evaluateFunctionCallInternal(fn, iter, dst);
	} popScope(iter);

	return rt;
}

function evaluateFunctionCallInternal(fn: ast.FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	// Users probably shouldn't be able to override builtin functions.
	const builtinFn = getBuiltinFn(fn.name.name);
	if (builtinFn) {
		return builtinFn(fn, iter, dst);
	}

	const functionName = fn.name.name;
	const userFn = getVar(iter, functionName);
	if (userFn) {
		if (userFn.type !== Result_Function) return setError(dst, "Value was not a function - it was a " + typeToString(userFn.type));

		const wantedNumArgs = userFn.val.args.length;
		const gotNumArgs    = fn.arguments.length;
		if (wantedNumArgs !== gotNumArgs) {
			return setError(dst, `Wanted ${wantedNumArgs} arguments for function ${fn.name.name}, got ${gotNumArgs} arguments instead`);
		}

		for (let i = 0; i < userFn.val.args.length; i++) {
			const argName = userFn.val.args[i].name.name;

			// TODO: argument types, type validation

			const argExpr = fn.arguments[i];
			const varSlot = createVar(iter, argName);
			const rt = evaluateExpression(argExpr, iter, varSlot); // We allow passing "nothing" into functions. Might change my mind later idk
			if (rt === RETURN_ERR) return setError(dst, varSlot.error);
		}

		// We only set the isolation flag on the current scope _now_ - we needed to read from the parent scope in order to 
		// populate the current scope. But the function call itself should have an isolated scope. 
		const scope = getCurrentScope(iter);
		scope.flags = scope.flags | SCOPE_ISOLATED;
		scope.flags = scope.flags & ~SCOPE_HIDDEN;

		return evaluateExpressionBlock(userFn.val.body, iter, dst);
	}

	return setError(dst, `Couldn't find function ${functionName} in this scope`);
}

function evaluateExpressionBlock(block: ast.Expression[], iter: ProgramIterator, dst: Slot): ExprReturn {
	const scope = getCurrentScope(iter);

	for (const expr of block) {
		if (scope.flags & SCOPE_ALLOW_CONTINUE_BREAK) {
			if (expr.type === ast.Expression_Break)    return setResult(dst, BREAK);
			if (expr.type === ast.Expression_Continue) return setResult(dst, CONTINUE);
		}

		const rt = evaluateExpression(expr, iter, dst);
		if (rt) return rt;
	}

	return RETURN_NONE;
}


function evaluateIfChain(expr: ast.IfChain, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (expr.blocks.length === 0) return setError(dst, "If chain was empty");

	let rt: ExprReturn = RETURN_NONE;

	pushScope(iter, currentScopeNonIsolatedFlags(iter)); {
		rt = evaluateIfChainInternal(expr, iter, dst);
	} popScope(iter);

	return rt;
}

function evaluateIfChainInternal(expr: ast.IfChain, iter: ProgramIterator, dst: Slot): ExprReturn {
	const check = newSlot();

	for (const branch of expr.blocks) {
		if (evaluateExpression(branch.check, iter, check) === RETURN_ERR) return setError(dst, check.error);
		if (check.result.type !== Result_Boolean)                         return setError(dst, "If check needs to be a boolean");
		if (check.result.val === true) {
			return evaluateExpressionBlock(branch.block, iter, dst); 
		}
	}

	if (expr.else) {
		return evaluateExpressionBlock(expr.else, iter, dst);
	}

	return RETURN_NONE;
}

function evaluateBinaryOperation(expr: ast.BinaryExpression, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (evaluateExpressionValue(expr.rhs, iter, dst) === RETURN_ERR) return RETURN_ERR;

	if (expr.op.type !== ast.OP_NONE) {
		const lhs = newSlot();
		if (evaluateExpressionValue(expr.lhs, iter, lhs) === RETURN_ERR) {
			return setError(dst, lhs.error);
		}
		if (evaluateBinaryOperationOnResults(lhs.result, expr.op.type, dst.result, dst) !== RETURN_VAL) {
			return RETURN_ERR;
		}
	}

	if (expr.op.assignment) {
		if (expr.lhs.type !== ast.Expression_Identifier) {
			return setError(dst, `Can't assign to ${ast.expressionToString(iter.program.code, expr)}`);
		}

		const varSlot = setOrCreateVar(iter, expr.lhs.name);
		setResult(varSlot, dst.result);
		dst.result = NOTHING;

		return RETURN_NONE;
	} 

	return RETURN_VAL;
}

function evaluateBinaryOperationOnResults(lhs: Result, exprOp: ast.BinaryOperatorType, rhs: Result, dst: Slot): ExprReturn {
	if (lhs.type === Result_Number && rhs.type === Result_Number) {
		switch (exprOp) {
			case ast.OP_ADD:             return setResultNumber(dst, lhs.val + rhs.val);
			case ast.OP_SUBTRACT:        return setResultNumber(dst, lhs.val - rhs.val);
			case ast.OP_MULTIPLY:        return setResultNumber(dst, lhs.val * rhs.val);
			case ast.OP_DIVIDE:          return setResultNumber(dst, lhs.val / rhs.val);
			case ast.OP_MODULO:          return setResultNumber(dst, lhs.val % rhs.val);
			case ast.OP_BITWISE_AND:     return setResultNumber(dst, lhs.val & rhs.val);
			case ast.OP_BITWISE_OR:      return setResultNumber(dst, lhs.val | rhs.val);
			case ast.OP_BITWISE_XOR:     return setResultNumber(dst, lhs.val ^ rhs.val);
			case ast.OP_LESS_THAN:       return setResultBoolean(dst, lhs.val < rhs.val);
			case ast.OP_LESS_THAN_EQ:    return setResultBoolean(dst, lhs.val <= rhs.val);
			case ast.OP_GREATER_THAN:    return setResultBoolean(dst, lhs.val > rhs.val);
			case ast.OP_GREATER_THAN_EQ: return setResultBoolean(dst, lhs.val >= rhs.val);
			case ast.OP_EQ:              return setResultBoolean(dst, lhs.val === rhs.val);
			case ast.OP_NOT_EQ:          return setResultBoolean(dst, lhs.val !== rhs.val);
			default:                     return setError(dst, invalidOperatorError(exprOp, lhs, rhs));
		}
	}

	if (lhs.type === Result_Boolean && rhs.type === Result_Boolean) {
		switch (exprOp) {
			case ast.OP_LOGICAL_AND: return setResultBoolean(dst, lhs.val && rhs.val);
			case ast.OP_LOGICAL_OR:  return setResultBoolean(dst, lhs.val || rhs.val);
			case ast.OP_LOGICAL_XOR: return setResultBoolean(dst, lhs.val != rhs.val);
			case ast.OP_EQ:          return setResultBoolean(dst, lhs.val === rhs.val);
			case ast.OP_NOT_EQ:      return setResultBoolean(dst, lhs.val !== rhs.val);
			default:                 return setError(dst, invalidOperatorError(exprOp, lhs, rhs));
		}
	}

	if (lhs.type === Result_String && rhs.type === Result_String) {
		switch (exprOp) {
			case ast.OP_ADD:     return setResultString(dst, lhs.val + rhs.val);
			case ast.OP_EQ:      return setResultBoolean(dst, lhs.val === rhs.val);
			case ast.OP_NOT_EQ:  return setResultBoolean(dst, lhs.val !== rhs.val);
			default:             return setError(dst, invalidOperatorError(exprOp, lhs, rhs));
		}
	}

	return setError(dst, `Can't apply ${ast.operatorToString(exprOp)} between ${typeToString(lhs.type)} and ${typeToString(rhs.type)}`);
}

function evaluateIdentifier(expr: ast.Identifier, iter: ProgramIterator, dst: Slot): ExprReturn {
	const val = getVar(iter, expr.name);
	if (!val) {
		return setError(dst, "Variable not found: " + expr.name);
	}

	return setResult(dst, val);
}

function evaluateForLoop(expr: ast.ForLoop, iter: ProgramIterator, dst: Slot): ExprReturn {
	let rt: ExprReturn = RETURN_NONE;

	pushScope(iter, SCOPE_ALLOW_CONTINUE_BREAK); {
		rt = evaluateForLoopInternal(expr, iter, dst);
	} popScope(iter);

	return rt;
}

function evaluateForLoopInternal(expr: ast.ForLoop, iter: ProgramIterator, dst: Slot): ExprReturn {
	const loopVarSlot = setOrCreateVar(iter, expr.range.varName.name);
	const rtStart = evaluateExpressionValue(expr.range.start, iter, loopVarSlot);
	if (rtStart === RETURN_ERR) return setError(dst, loopVarSlot.error);
	if (loopVarSlot.result.type !== Result_Number) return setError(dst, "For loop range start needs to be a number");

	const end = newSlot();

	outer: while (true) {
		const rtEnd = evaluateExpressionValue(expr.range.end, iter, end);
		if (rtEnd === RETURN_ERR) return setError(dst, end.error);
		if (end.result.type !== Result_Number) return setError(dst, "For loop range end needs to be a number");

		let endVal = end.result.val;

		let nextLoopVal = loopVarSlot.result.val;

		switch (expr.range.rangeType) {
			case ast.RANGE_LT: {
				if (loopVarSlot.result.val >= endVal) break outer;
				nextLoopVal += 1;
			} break;
			case ast.RANGE_LTE: {
				if (nextLoopVal > endVal)  break outer;
				nextLoopVal += 1;
			} break;
			case ast.RANGE_GT: {
				if (nextLoopVal <= endVal) break outer;
				nextLoopVal -= 1;
			} break;
			case ast.RANGE_GTE: {
				if (nextLoopVal < endVal)  break outer;
				nextLoopVal -= 1;
			} break;
			default: {
				assertNever(expr.range.rangeType);
			}
		}

		const rt = evaluateExpressionBlock(expr.statements, iter, dst);
		if (rt === RETURN_ERR) return RETURN_ERR;
		if (rt === RETURN_VAL) {
			if (dst.result === BREAK) return setResult(dst, NOTHING);
			if (dst.result === CONTINUE) {
				setResult(dst, NOTHING);
				loopVarSlot.result.val = nextLoopVal;
				continue;
			}
		}

		loopVarSlot.result.val = nextLoopVal;
	}

	return RETURN_NONE;
}

function evaluateIndexer(expr: ast.Indexer, iter: ProgramIterator, dst: Slot): ExprReturn {
	const targetDst = iter.temp1;
	if (evaluateExpression(expr.index, iter, dst) === RETURN_ERR)        return RETURN_ERR;
	if (evaluateExpression(expr.target, iter, targetDst) === RETURN_ERR) return setError(dst, targetDst.error);

	const indexResult = dst.result
	const targetResult = targetDst.result;

	if (targetResult.type === Result_List) {
		if (indexResult.type !== Result_Number) {
			return setError(dst, "List indexer needs to be a number");
		}
		const index = Math.floor(indexResult.val);
		if (index < 0 || index >= targetResult.val.length) {
			return setError(dst, "Index was out of bounds: " + index + "/" + targetResult.val.length);
		}
		const value = targetResult.val[index];
		return setResult(dst, value);
	}

	if (targetResult.type === Result_Map) {
		const key = getMapKey(indexResult);
		if (key === undefined) {
			return setError(dst, "Invalid map key");
		}

		const val = targetResult.val.get(key);
		if (val === undefined) return setResult(dst, NOTHING);
		return setResult(dst, val.val);
	}

	return setError(dst, typeToString(targetResult.type) + " cannot be indexed");
}

function evaluateTypeInitializer(expr: ast.TypeInitializer, iter: ProgramIterator, dst: Slot): ExprReturn {
	switch (expr.typename.name) {
		case "list": {
			const result: Result = { type: Result_List, val: [] };

			const slot = newSlot();
			for (const arg of expr.args) {
				if (evaluateExpressionValue(arg, iter, slot) === RETURN_ERR) return setError(dst, slot.error);
				// We'll allow empty values in the list, why not.
				result.val.push(cloneResult(slot.result));
			}

			return setResult(dst, result);
		} break;
		case "map": {
			const result: Result = { type: Result_Map, val: new Map() };

			// for now, we'll just ignore type args. xd
			const slotKey = newSlot();
			const slotVal = newSlot();
			for (const arg of expr.args) {
				if (
					arg.type !== ast.Expression_BinaryExpression ||
					!arg.op.assignment || 
					arg.op.type !== ast.OP_NONE
				) {
					return setError(dst, "Maps should be initialized like { key=value, key=value, etc. }");
				} 
				
				if (evaluateExpression(arg.lhs, iter, slotKey) === RETURN_ERR) return setError(dst, slotKey.error);
				const mapKey = getMapKey(slotKey.result)
				if (mapKey === undefined) {
					return setError(dst, `type ${typeToString(slotKey.result.type)} can't be used as a map key`);
				}

				if (evaluateExpression(arg.rhs, iter, slotVal) === RETURN_ERR) return setError(dst, slotVal.error);

				if (result.val.has(mapKey)) return setError(dst, "Map initializer cannot contain duplicate keys");

				const slot = { key: slotKey.result, val: cloneResult(slotVal.result) };
				result.val.set(mapKey, slot);
			}

			return setResult(dst, result);
		} break;
	}

	return setError(dst, `Don't know how to initialize this type: ${expr.typename.name}`);
}


export function getMapKey(result: Result): ValidMapKey | undefined {
	switch (result.type) {
		case Result_Nothing:  return NOTHING;
		case Result_Number:   return result.val;
		case Result_String:   return result.val;
		case Result_Boolean:  return result.val;
	}
	return undefined;
}

export function resultToString(result: Result): string {
	switch (result.type) {
		case Result_Nothing:  return "<nothing>";
		case Result_Number:   return "" + result.val;
		case Result_String:   return result.val;
		case Result_Boolean:  return "" + result.val;
		// TODO: consider making it possible to know the name of the function when we do <ident> = fn() {...}
		case Result_Function: return "fn (" + result.val.args.map(a => a.name).join(", ") + ")"; 
		case Result_List:     return "list[" + result.val.map(resultToString).join(", ") + "]";
		case Result_Map:      return "map[" + [...result.val.values()].map((e) => resultToString(e.key) + " -> " + resultToString(e.val)).join(", ") + "]";
		default: assertNever(result);
	}
	return "unknown string representation";
}

