import { assert, assertNever } from "./assert";
import * as ast from "./ast";
import { cloneMatrix, matrixSetAxis, matrixGetIndex, matrixValuesToString, Matrix } from "./matrix";
import { newParser } from "./parser";

export const Result_Nothing  = 0; // Also represented with 'undefined'
// Maybe we want to think about the different types of numbers at some point. i32, i64, f32, f64. Right now we just inherit Javascript's numbers.
// If this was done in web assembly, we could do something better.
export const Result_Number   = 1;
export const Result_String   = 2;
export const Result_Boolean  = 3; // kinda pointless if you think about it. 0/nonzero also encodes this.
export const Result_Function = 4;
export const Result_List     = 5;
export const Result_Map      = 6;
// It's tempting to represent Vectors and Matrices with the same type underneath, 
// and even to use Tensors instead of limiting oneself to 2D matrices. 
// However, I have experienced in my previous attempt at writing this language, that 
// the code just gets super complicated, and the actual intent of the programmer gets lost 
// too, which makes it harder to visualise the results in a useful way.
export const Result_Vector   = 7; 
export const Result_Matrix   = 8;
// TODO: export const Result_Quaternion = 9;
export const Result_BuiltinFunction = 10;

export function resultTypeToString(type: ResultType) {
	switch(type) {
		case Result_Nothing:  return "Nothing";
		case Result_Number:   return "Number";
		case Result_String:   return "String";
		case Result_Boolean:  return "Boolean";
		case Result_Function: return "Function";
		case Result_BuiltinFunction:   return "*Function";
		case Result_List:     return "List";
		case Result_Map:      return "Map";
		case Result_Vector:   return "Vector";
		case Result_Matrix:   return "Matrix";
		default: assertNever(type);
	}
}

export type ResultType = Result["type"];

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

export type BuiltinFn = (fn: ast.FunctionCall, iter: ProgramIterator) => ExprReturn;

export type ResultBuiltinFunction = ResultBase & {
	type: typeof Result_BuiltinFunction;
	val:  BuiltinFn;
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

export type ResultVector = ResultBase & {
	type: typeof Result_Vector;
	val:  number[];
};

export type ResultMatrix = ResultBase & {
	type: typeof Result_Matrix;
	val: Matrix;
};

export type Result =
 | ResultNumber
 | ResultString
 | ResultBoolean
 | ResultFunction
 | ResultBuiltinFunction
 | ResultNothing
 | ResultList
 | ResultMap
 | ResultVector
 | ResultMatrix
 ;

export function cloneResultIfValueSemantics(src: Result): Result {
	switch(src.type) {
		case Result_Nothing:           return { type: src.type, val: src.val };
		case Result_Number:            return { type: src.type, val: src.val };
		case Result_String:            return { type: src.type, val: src.val };
		case Result_Boolean:           return { type: src.type, val: src.val };
		case Result_Function:          return { type: src.type, val: src.val };
		case Result_BuiltinFunction:   return { type: src.type, val: src.val };
		// These container types will actually have value semantics
		case Result_Vector: return { type: src.type, val: src.val.map(x => x) };
		case Result_Matrix: return { type: src.type, val: cloneMatrix(src.val) };
		// Typical by-reference semantics
		case Result_List:              return { type: src.type, val: src.val };
		case Result_Map:			   return { type: src.type, val: src.val };
		default: assertNever(src);
	}
}

export type ProgramIterator = {
	program: ast.Program;
	nextStatementIdx: number;

	stack:  ast.Expression[];
	scopes: Scope[];

	logs: LogEntry[];

	lastResult: {
		result: Result;
		error: {
			message: string;
			expr:    ast.Expression;
		} | undefined;
	};
}

export type LogEntry = {
	expr: ast.Expression;
	text: string;
}

export type Scope = {
	vars: Map<string, Result>;
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
		lastResult: {
			result: NOTHING,
			error:  undefined,
		},
		stack:  [],
		scopes: [],
		logs:   [],
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
	const builtin = getBuiltin(name);
	if (builtin) {
		return builtin;
	}

	if (iter.scopes.length === 0) return undefined;

	for (let i = iter.scopes.length - 1; i > 0; i--) {
		const scope = iter.scopes[i];
		if (scope.flags & SCOPE_HIDDEN) {
			continue;
		}

		const value = scope.vars.get(name)
		if (value) {
			return value;
		}

		if (scope.flags & SCOPE_ISOLATED) {
			break;
		}
	}

	// Also search the global scope - it's available to every other scope
	{
		const value = iter.scopes[0].vars.get(name);
		if (value) {
			return value;
		}
	}

	return undefined;
}

export function setOrCreateVar(iter: ProgramIterator, name: string, val: Result){
	if (iter.scopes.length === 0) return;

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

	scopeToUse.vars.set(name, val);
}

export function createVar(
	iter: ProgramIterator,
	name: string,
	val: Result,
	conflictMessage: string,
	conflictExpr: ast.Expression,
): ExprReturn {
	const scope = getCurrentScope(iter);

	if (scope.vars.has(name)) {
		return setError(iter, conflictExpr, conflictMessage);
	}

	scope.vars.set(name, val);
	return RETURN_NONE;
}


// NOTE: compared by reference. You can't just construct the same object and expect it to work
export const NOTHING:  ResultNothing = { type: Result_Nothing, val: undefined }
export const BREAK:    ResultNothing = { type: Result_Nothing, val: undefined }
export const CONTINUE: ResultNothing = { type: Result_Nothing, val: undefined }

export const RETURN_NONE   = 0;
export const RETURN_RESULT = 1;
export const RETURN_ERROR  = 2;

export type ExprReturn = 
 | typeof RETURN_NONE
 | typeof RETURN_RESULT
 | typeof RETURN_ERROR
 ;









export function interpretProgram(program: ast.Program): ProgramIterator {
	const iter = newProgramIterator(program);

	// The root scope will never get popped.
	pushScope(iter, 0); 

	for (const expr of program.statements) {
		const rt = evaluateExpression(expr, iter);
		if (rt !== RETURN_NONE) break;
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

export function setError(iter: ProgramIterator, expr: ast.Expression, reason: string): typeof RETURN_ERROR {
	iter.lastResult.error = {
		message: reason,
		expr: expr,
	};
	return RETURN_ERROR;
}

export function setResultNumber(iter: ProgramIterator, val: number): typeof RETURN_NONE {
	iter.lastResult.result = newNumber(val);
	return RETURN_NONE;
}

export function setResultBoolean(iter: ProgramIterator, val: boolean): typeof RETURN_NONE {
	iter.lastResult.result = newBoolean(val);
	return RETURN_NONE;
}

export function setResultString(iter: ProgramIterator, val: string): typeof RETURN_NONE {
	iter.lastResult.result = newString(val);
	return RETURN_NONE;
}

export function setResult(iter: ProgramIterator, val: Result): typeof RETURN_NONE {
	iter.lastResult.result = val;
	return RETURN_NONE;
}

export function setReturnResult(iter: ProgramIterator, val: Result): typeof RETURN_RESULT {
	iter.lastResult.result = val;
	return RETURN_RESULT;
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
	return `${ast.operatorToString(opType)} is not valid for ${resultTypeToString(lhs.type)} with ${resultTypeToString(rhs.type)}`;
}

// TODO: Don't end up with this - we need an alternative formulation that lets us step through the program.
// It doesn't need to be an elaborate VM like last time - a simple control-flow graph is fine.
export function evaluateExpression(expr: ast.Expression, iter: ProgramIterator): ExprReturn {
	switch (expr.type) {
		case ast.Expression_Identifier:         return evaluateIdentifier(expr, iter);
		case ast.Expression_Indexer:            return evaluateIndexer(expr, iter);
		case ast.Expression_BinaryExpression:   return evaluateBinaryOperation(expr, iter);
		case ast.Expression_UnaryExpression:    return evaluateUnaryOperation(expr, iter);
		case ast.Expression_FunctionCall:       return evaluateFunctionCall(expr, iter);
		case ast.Expression_IfChain:            return evaluateIfChain(expr, iter); 
		case ast.Expression_ForLoop:            return evaluateForLoop(expr, iter);
		case ast.Expression_TypeInitializer:    return evaluateTypeInitializer(expr, iter);
		case ast.Expression_NumberLiteral:      return setResultNumber(iter, expr.val);
		case ast.Expression_StringLiteral:      return setResultString(iter, expr.val);
		case ast.Expression_BooleanLiteral:     return setResultBoolean(iter, expr.val);
		case ast.Expression_FunctionDefinition: {
			const fn: ResultFunction = { type: Result_Function, val: expr };
			if (expr.name) {
				if (createVar(iter, expr.name.name, fn, "A value with this name already exists", expr.name) === RETURN_ERROR) {
					return RETURN_ERROR;
				}
			}

			return setResult(iter, fn);
		} break;
		case ast.Expression_Return: {
			if (!expr.expr)                                           return setResult(iter, NOTHING);
			if (evaluateExpression(expr.expr, iter) === RETURN_ERROR) return RETURN_ERROR;
			return RETURN_RESULT;
		}
		case ast.Expression_ReturnBlock: {
			let result;
			pushScope(iter, 0); {
				result = evaluateExpressionBlock(expr.block, iter);
			} popScope(iter);
			return result;
		}
		case ast.Expression_ForLoopRange: return setError(iter, expr, "Can't use a for-loop range outside of a for-loop.");
		case ast.Expression_Continue: return RETURN_NONE;
		case ast.Expression_Break:    return RETURN_NONE;
		default: {
			assertNever(expr);
		} break;
	}
}

export function evaluateExpressionValue(expr: ast.Expression, iter: ProgramIterator): Result | undefined {
	const rt = evaluateExpression(expr, iter);
	if (rt === RETURN_ERROR) return undefined;
	return iter.lastResult.result;
}

export function evaluateCode(code: string, iter: ProgramIterator): [Result, string | undefined] {
	const expr = ast.parseExpressionFromText(code);
	if (!expr) return [NOTHING, "Couldn't parse the expression"];
	
	evaluateExpression(expr, iter);
	return [iter.lastResult.result, iter.lastResult.error?.message];
}

export function evaluateFunctionCall(fn: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	let rt: ExprReturn = RETURN_NONE;

	// Needs to be hidden. When we create new variables in this scope
	pushScope(iter, SCOPE_HIDDEN); {
		rt = evaluateFunctionCallInternal(fn, iter);
	} popScope(iter);

	return rt;
}

function evaluateFunctionCallInternal(fn: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	const functionName = fn.name.name;
	const userFn = getVar(iter, functionName);
	if (!userFn) {
		return setError(iter, fn.name, `Couldn't find function ${functionName} in this scope`);
	}

	if (userFn.type === Result_BuiltinFunction) {
		return userFn.val(fn, iter);
	} 

	if (userFn.type === Result_Function) {
		const wantedNumArgs = userFn.val.args.length;
		const gotNumArgs    = fn.arguments.length;
		if (wantedNumArgs !== gotNumArgs) {
			return setError(iter, fn, `Wanted ${wantedNumArgs} arguments for function ${fn.name.name}, got ${gotNumArgs} arguments instead`);
		}

		for (let i = 0; i < userFn.val.args.length; i++) {
			const argName = userFn.val.args[i].name.name;

			// TODO: argument types, type validation

			const argExpr = fn.arguments[i];
			const argResult = evaluateExpressionValue(argExpr, iter); // We allow passing "nothing" into functions. Might change my mind later idk
			if (!argResult) return RETURN_ERROR;
			if (createVar(iter, argName, argResult, "An argument with this name already exists", argExpr) === RETURN_ERROR) {
				return RETURN_ERROR;
			}
		}

		// We only set the isolation flag on the current scope _now_ - we needed to read from the parent scope in order to 
		// populate the current scope. But the function call itself should have an isolated scope. 
		const scope = getCurrentScope(iter);
		scope.flags = scope.flags | SCOPE_ISOLATED;
		scope.flags = scope.flags & ~SCOPE_HIDDEN;

		if (evaluateExpressionBlock(userFn.val.body, iter) === RETURN_ERROR) return RETURN_ERROR;
		return RETURN_NONE;
	}

	
	return setError(iter, fn.name, "Value was not a function - it was a " + resultTypeToString(userFn.type));
}

function evaluateExpressionBlock(block: ast.Expression[], iter: ProgramIterator): ExprReturn {
	const scope = getCurrentScope(iter);

	for (const expr of block) {
		if (scope.flags & SCOPE_ALLOW_CONTINUE_BREAK) {
			if (expr.type === ast.Expression_Break)    return setResult(iter, BREAK);
			if (expr.type === ast.Expression_Continue) return setResult(iter, CONTINUE);
		}

		const rt = evaluateExpression(expr, iter);
		if (rt !== RETURN_NONE) return rt;
	}

	return RETURN_NONE;
}


function evaluateIfChain(expr: ast.IfChain, iter: ProgramIterator): ExprReturn {
	if (expr.blocks.length === 0) return setError(iter, expr, "If chain was empty");

	let rt: ExprReturn = RETURN_NONE;

	pushScope(iter, currentScopeNonIsolatedFlags(iter)); {
		rt = evaluateIfChainInternal(expr, iter);
	} popScope(iter);

	return rt;
}

function evaluateIfChainInternal(expr: ast.IfChain, iter: ProgramIterator): ExprReturn {
	for (const branch of expr.blocks) {
		const val = evaluateExpressionValue(branch.check, iter);
		if (!val)                        return RETURN_ERROR;
		if (val.type !== Result_Boolean) {
			// This is good actually.
			return setError(iter, branch.check, "If check needs to be a boolean");
		}
		if (val.val === true) {
			return evaluateExpressionBlock(branch.block, iter); 
		}
	}

	if (expr.else) {
		return evaluateExpressionBlock(expr.else, iter);
	}

	return RETURN_NONE;
}

export function evaluateBinaryOperation(expr: ast.BinaryExpression, iter: ProgramIterator): ExprReturn {
	let result; 

	if (expr.op.type !== ast.OP_NONE) {
		// TODO: test - evaluation must be left -> right
		const lhsVal = evaluateExpressionValue(expr.lhs, iter);
		if (!lhsVal) return RETURN_ERROR;

		let rhsVal = evaluateExpressionValue(expr.rhs, iter);
		if (!rhsVal) return RETURN_ERROR;

		if (evaluateBinaryOperationOnResults(expr, lhsVal, expr.op.type, rhsVal, iter) === RETURN_ERROR) return RETURN_ERROR;
		result = iter.lastResult.result;
		if (!result) return RETURN_ERROR;
	} else {
		result = evaluateExpressionValue(expr.rhs, iter);
		if (!result) return RETURN_ERROR;
	}

	if (expr.op.assignment) {
		return evaluateAssignment(expr, iter, result);
	} 

	return RETURN_NONE;
}

export function evaluateUnaryOperation(expr: ast.UnaryExpression, iter: ProgramIterator): ExprReturn { 
	const exprResult = evaluateExpressionValue(expr.expr, iter);
	if (!exprResult) return RETURN_ERROR;

	if (exprResult.type === Result_Boolean) {
		switch (expr.op) {
			case ast.UNARY_OP_NOT: return setResultBoolean(iter, !exprResult.val);
			default: return unaryOperatorCantBeAppliedError(iter, expr, exprResult);
		}
	} 

	if (exprResult.type === Result_Number) {
		switch (expr.op) {
			case ast.UNARY_OP_NOT:         return setResultNumber(iter, exprResult.val ? 0 : 1);
			case ast.UNARY_OP_BITWISE_NOT: return setResultNumber(iter, ~exprResult.val);
			default: return unaryOperatorCantBeAppliedError(iter, expr, exprResult);
		}
	}

	if (exprResult.type === Result_Vector) {
		const result: ResultVector = {
			type: Result_Vector,
			val: exprResult.val.map(x => x),
		};

		switch (expr.op) {
			case ast.UNARY_OP_NOT:         { for (let i = 0; i < result.val.length; i++) { result.val[i] = result.val[i] ? 0 : 1; } } break;
			case ast.UNARY_OP_BITWISE_NOT: { for (let i = 0; i < result.val.length; i++) { result.val[i] = ~result.val[i]; } } break;
			default: return unaryOperatorCantBeAppliedError(iter, expr, result);
		}

		return setResult(iter, result);
	}

	if (exprResult.type === Result_Matrix) {
		const result: ResultMatrix = {
			type: Result_Matrix,
			val:  cloneMatrix(exprResult.val),
		};

		switch (expr.op) {
			case ast.UNARY_OP_NOT:         { for (let i = 0; i < result.val.data.length; i++) { result.val.data[i] = result.val.data[i] ? 0 : 1; } } break;
			case ast.UNARY_OP_BITWISE_NOT: { for (let i = 0; i < result.val.data.length; i++) { result.val.data[i] = ~result.val.data[i]; } } break;
			default: return unaryOperatorCantBeAppliedError(iter, expr, result);
		}

		return setResult(iter, result);
	}

	return unaryOperatorCantBeAppliedError(iter, expr, exprResult);
}

function unaryOperatorCantBeAppliedError(iter: ProgramIterator, expr: ast.UnaryExpression, result: Result): ExprReturn {
	return setError(
		iter,
		expr,
		`Couldn't apply unary operator ${ast.unaryOperatorToString(expr.op)} to type ${resultTypeToString(result.type)}`
	);
}

export type IndexableResult =
 | ResultString
 | ResultList
 | ResultMap
 | ResultVector
 | ResultMatrix
 ; 

function asIndexableResult(result: Result): IndexableResult | undefined {
	switch (result.type) {
		case Result_String: return result;
		case Result_List:   return result;
		case Result_Map:    return result;
		case Result_Vector: return result;
		case Result_Matrix: return result;
	}
	return undefined;
}

export function evaluateAssignment(expr: ast.BinaryExpression, iter: ProgramIterator, value: Result): ExprReturn {
	value = cloneResultIfValueSemantics(value);

	if (expr.lhs.type === ast.Expression_Identifier) {
		setOrCreateVar(iter, expr.lhs.name, value);
		// Setting a variable means that it won't get returned. 
		// This is actually one of the main semantics of the language.
		// But I dont really want rust style naked returns though.
		return RETURN_NONE;
	}

	if (expr.lhs.type === ast.Expression_Indexer) {
		const targetResult = evaluateExpressionValue(expr.lhs.target, iter);
		if (!targetResult) return RETURN_ERROR;

		const target = asIndexableResult(targetResult);
		if (!target) {
			return setError(iter, expr.lhs.target, "Expression can't be indexed: " + ast.expressionToString(iter.program.code, expr.lhs.target));
		}

		switch(target.type) {
			case Result_String: return setError(iter, expr.lhs.target, "Strings are immutable, and individual characters can't be assigned to.");
			case Result_List: {
				const index = evaluateExpressionValue(expr.lhs.indexes[0], iter);
				if (!index) return RETURN_ERROR;
		
				if (index.type !== Result_Number)                    return setError(iter, expr.lhs.indexes[0], "List index should be a number");
				if (index.val < 0 || index.val >= target.val.length) return setError(iter, expr.lhs.indexes[0], `Index [${index.val}] out-of-bounds (${target.val.length})`);
				target.val[index.val] = target;
			} break;
			case Result_Map: {
				const index = evaluateExpressionValue(expr.lhs.indexes[0], iter);
				if (!index) return RETURN_ERROR;

				setMapKey(iter, target, index, expr.lhs.indexes[0], value);
			} break;
			case Result_Vector: {
				const index = evaluateExpressionValue(expr.lhs.indexes[0], iter);
				if (!index) return RETURN_ERROR;

				if (index.type !== Result_Number)                    return setError(iter, expr.lhs.indexes[0], "Vector index should be a number");
				if (value.type !== Result_Number)                    return setError(iter, expr.lhs.indexes[0], "Vector values should be numbers");
				if (index.val < 0 || index.val >= target.val.length) return setError(iter, expr.lhs.indexes[0], `Index [${index.val}] out-of-bounds (${target.val.length})`);
				target.val[index.val] = value.val;
			} break;
			case Result_Matrix: {
				if (expr.lhs.indexes.length === 1) {
					if (value.type !== Result_Vector)         return setError(iter, expr.rhs, "Only vectors can be asigned to a column in a matrix");
					if (value.val.length !== target.val.rows) return setError(iter, expr.lhs.indexes[0], `Vector length ${value.val.length} was not equal to the height (${target.val.rows}) of the matrix`);

					const index = evaluateExpressionValue(expr.lhs.indexes[0], iter);
					if (!index)                                        return RETURN_ERROR;
					if (index.type !== Result_Number)                  return setError(iter, expr.lhs.indexes[0], "Matrix index should be a number");
					if (index.val < 0 || index.val >= target.val.cols) return setError(iter, expr.lhs.indexes[0], `Index [${index.val}] out-of-bounds (${target.val.cols} cols)`);

					matrixSetAxis(target.val, value.val, index.val);
				} else if (expr.lhs.indexes.length === 2) {
					if (value.type !== Result_Number) return setError(iter, expr.rhs, "Matrix values should be numbers");

					const row = evaluateExpressionValue(expr.lhs.indexes[0], iter);
					if (!row) return RETURN_ERROR;
					if (row.type !== Result_Number) return setError(iter, expr.lhs.indexes[0], "Matrix row should be a number");
					if (row.val < 0 || row.val >= target.val.rows) return setError(iter, expr.lhs.indexes[0], `Index [${row.val}] out-of-bounds (${target.val.rows} rows)`);

					const col = evaluateExpressionValue(expr.lhs.indexes[1], iter);
					if (!col) return RETURN_ERROR;
					if (col.type !== Result_Number) return setError(iter, expr.lhs.indexes[1], "Matrix column should be a number");
					if (col.val < 0 || col.val >= target.val.cols) return setError(iter, expr.lhs.indexes[0], `Index [${col.val}] out-of-bounds (${target.val.cols} rows)`);

					const idx = matrixGetIndex(target.val, row.val, col.val);
					target.val.data[idx] = value.val;
				} else {
					return setError(iter, expr.lhs, "Too many index expressions for this matrix, just do [columnIdx] or [rowIdx, colIdx]");
				}
			} break;

			default: assertNever(target);
		}

		return RETURN_NONE;
	}

	return setError(iter, expr.rhs, `Can't assign to ${ast.expressionToString(iter.program.code, expr.lhs)}`);
}

export function evaluateBinaryOperationOnResults(expr: ast.BinaryExpression, lhs: Result, exprOp: ast.BinaryOperatorType, rhs: Result, iter: ProgramIterator): ExprReturn{
	if (lhs.type === Result_Number && rhs.type === Result_Number) {
		switch (exprOp) {
			case ast.OP_ADD:             return setResultNumber(iter, lhs.val + rhs.val);
			case ast.OP_SUBTRACT:        return setResultNumber(iter, lhs.val - rhs.val);
			case ast.OP_MULTIPLY:        return setResultNumber(iter, lhs.val * rhs.val);
			case ast.OP_DIVIDE:          return setResultNumber(iter, lhs.val / rhs.val);
			case ast.OP_MODULO:          return setResultNumber(iter, lhs.val % rhs.val);
			case ast.OP_BITWISE_AND:     return setResultNumber(iter, lhs.val & rhs.val);
			case ast.OP_BITWISE_OR:      return setResultNumber(iter, lhs.val | rhs.val);
			case ast.OP_BITWISE_XOR:     return setResultNumber(iter, lhs.val ^ rhs.val);
			case ast.OP_LESS_THAN:       return setResultBoolean(iter, lhs.val < rhs.val);
			case ast.OP_LESS_THAN_EQ:    return setResultBoolean(iter, lhs.val <= rhs.val);
			case ast.OP_GREATER_THAN:    return setResultBoolean(iter, lhs.val > rhs.val);
			case ast.OP_GREATER_THAN_EQ: return setResultBoolean(iter, lhs.val >= rhs.val);
			case ast.OP_EQ:              return setResultBoolean(iter, lhs.val === rhs.val);
			case ast.OP_NOT_EQ:          return setResultBoolean(iter, lhs.val !== rhs.val);
			default:                     return setError(iter, expr, invalidOperatorError(exprOp, lhs, rhs));
		}
	}

	if (lhs.type === Result_Boolean && rhs.type === Result_Boolean) {
		switch (exprOp) {
			case ast.OP_LOGICAL_AND: return setResultBoolean(iter, lhs.val && rhs.val);
			case ast.OP_LOGICAL_OR:  return setResultBoolean(iter, lhs.val || rhs.val);
			case ast.OP_LOGICAL_XOR: return setResultBoolean(iter, lhs.val != rhs.val);
			case ast.OP_EQ:          return setResultBoolean(iter, lhs.val === rhs.val);
			case ast.OP_NOT_EQ:      return setResultBoolean(iter, lhs.val !== rhs.val);
			default:                 return setError(iter, expr, invalidOperatorError(exprOp, lhs, rhs));
		}
	}

	if (lhs.type === Result_String && rhs.type === Result_String) {
		switch (exprOp) {
			case ast.OP_ADD:     return setResultString(iter, lhs.val + rhs.val);
			case ast.OP_EQ:      return setResultBoolean(iter, lhs.val === rhs.val);
			case ast.OP_NOT_EQ:  return setResultBoolean(iter, lhs.val !== rhs.val);
			default:             return setError(iter, expr, invalidOperatorError(exprOp, lhs, rhs));
		}
	}

	if (lhs.type === Result_Vector && rhs.type === Result_Vector) {
		if (rhs.val.length !== lhs.val.length) {
			return setError(iter, expr, `Vectors did not have the same sizes (${rhs.val.length} and ${lhs.val.length})`);
		}

		const result: Result = {
			type: Result_Vector,
			val: Array(rhs.val.length).fill(0)
		};

		switch (exprOp) {
			case ast.OP_ADD:             { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] +   rhs.val[i]; } } break;
			case ast.OP_SUBTRACT:        { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] -   rhs.val[i]; } } break;
			case ast.OP_MODULO:          { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] %   rhs.val[i]; } } break;
			case ast.OP_MULTIPLY:        { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] *   rhs.val[i]; } } break;
			case ast.OP_DIVIDE:          { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] /   rhs.val[i]; } } break;
			case ast.OP_LOGICAL_AND:     { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = (!!(lhs.val[i]) &&  (!!rhs.val[i])) ? 1 : 0} } break;
			case ast.OP_LOGICAL_OR:      { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = (!!(lhs.val[i]) &&  (!!rhs.val[i])) ? 1 : 0} } break;
			case ast.OP_LOGICAL_XOR:     { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = (!!(lhs.val[i]) !== (!!rhs.val[i])) ? 1 : 0} } break;
			case ast.OP_BITWISE_AND:     { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] & rhs.val[i] } } break;
			case ast.OP_BITWISE_OR:      { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] | rhs.val[i] } } break;
			case ast.OP_BITWISE_XOR:     { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] ^ rhs.val[i] } } break;
			case ast.OP_LESS_THAN:       { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] <   rhs.val[i] ? 1 : 0; } } break;
			case ast.OP_LESS_THAN_EQ:    { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] <=  rhs.val[i] ? 1 : 0; } } break;
			case ast.OP_GREATER_THAN:    { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] >   rhs.val[i] ? 1 : 0; } } break;
			case ast.OP_GREATER_THAN_EQ: { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] >=  rhs.val[i] ? 1 : 0; } } break;
			case ast.OP_EQ:              { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] === rhs.val[i] ? 1 : 0; } } break;
			case ast.OP_NOT_EQ:          { for (let i = 0; i < rhs.val.length; i++) { result.val[i] = lhs.val[i] !== rhs.val[i] ? 1 : 0; } } break;
			default: return setError(iter, expr, invalidOperatorError(exprOp, lhs, rhs));
		}

		return setResult(iter, result);
	}

	if (lhs.type === Result_Matrix && rhs.type === Result_Matrix) {
		if (rhs.val.rows !== lhs.val.rows) return setError(iter, expr, `Matrices did not have the same row count`);
		if (rhs.val.cols !== lhs.val.cols) return setError(iter, expr, `Matrices did not have the same column count`);

		const result: Result = {
			type: Result_Matrix,
			val: {
				rows: rhs.val.rows,
				cols: rhs.val.cols,
				data: Array(rhs.val.data.length).fill(0)
			}
		};

		switch (exprOp) {
			case ast.OP_ADD:             { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] +   rhs.val.data[i]; } } break;
			case ast.OP_SUBTRACT:        { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] -   rhs.val.data[i]; } } break;
			case ast.OP_MODULO:          { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] %   rhs.val.data[i]; } } break;
			case ast.OP_MULTIPLY:        { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] *   rhs.val.data[i]; } } break;
			case ast.OP_DIVIDE:          { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] /   rhs.val.data[i]; } } break;
			case ast.OP_LOGICAL_AND:     { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = (!!(lhs.val.data[i]) &&  (!!rhs.val.data[i])) ? 1 : 0} } break;
			case ast.OP_LOGICAL_OR:      { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = (!!(lhs.val.data[i]) &&  (!!rhs.val.data[i])) ? 1 : 0} } break;
			case ast.OP_LOGICAL_XOR:     { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = (!!(lhs.val.data[i]) !== (!!rhs.val.data[i])) ? 1 : 0} } break;
			case ast.OP_BITWISE_AND:     { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] & rhs.val.data[i] } } break;
			case ast.OP_BITWISE_OR:      { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] | rhs.val.data[i] } } break;
			case ast.OP_BITWISE_XOR:     { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] ^ rhs.val.data[i] } } break;
			case ast.OP_LESS_THAN:       { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] <   rhs.val.data[i] ? 1 : 0; } } break;
			case ast.OP_LESS_THAN_EQ:    { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] <=  rhs.val.data[i] ? 1 : 0; } } break;
			case ast.OP_GREATER_THAN:    { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] >   rhs.val.data[i] ? 1 : 0; } } break;
			case ast.OP_GREATER_THAN_EQ: { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] >=  rhs.val.data[i] ? 1 : 0; } } break;
			case ast.OP_EQ:              { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] === rhs.val.data[i] ? 1 : 0; } } break;
			case ast.OP_NOT_EQ:          { for (let i = 0; i < rhs.val.data.length; i++) { result.val.data[i] = lhs.val.data[i] !== rhs.val.data[i] ? 1 : 0; } } break;
			default: return setError(iter, expr, invalidOperatorError(exprOp, lhs, rhs));
		}

		return setResult(iter, result);
	}

	return setError(iter, expr, `Can't apply ${ast.operatorToString(exprOp)} between ${resultTypeToString(lhs.type)} and ${resultTypeToString(rhs.type)}`);
}

function evaluateIdentifier(expr: ast.Identifier, iter: ProgramIterator): ExprReturn {
	const val = getVar(iter, expr.name);
	if (!val) {
		return setError(iter, expr, "Variable not found: " + expr.name);
	}

	return setResult(iter, val);
}

function evaluateForLoop(expr: ast.ForLoop, iter: ProgramIterator): ExprReturn {
	let rt: ExprReturn = RETURN_NONE;

	pushScope(iter, SCOPE_ALLOW_CONTINUE_BREAK); {
		rt = evaluateForLoopInternal(expr, iter);
	} popScope(iter);

	return rt;
}

const LOOP_NOTHING  = 0;
const LOOP_BREAK    = 1;
const LOOP_CONTINUE = 2;
const LOOP_RETURN   = 3;

function evaluateLoopStatementReturn(iter: ProgramIterator, rt: ExprReturn): number {
	if (rt === RETURN_ERROR) return RETURN_ERROR;
	if (rt === RETURN_RESULT) {
		if (iter.lastResult.result === BREAK) {
			setResult(iter, NOTHING);
			return LOOP_BREAK;
		}

		if (iter.lastResult.result === CONTINUE) {
			setResult(iter, NOTHING);
			return LOOP_CONTINUE;
		}

		return LOOP_RETURN;
	}

	return LOOP_NOTHING;
}

function evaluateForLoopInternal(expr: ast.ForLoop, iter: ProgramIterator): ExprReturn {
	if (expr.toIterate.type === ast.Expression_ForLoopRange) {
		if (expr.varNames.length !== 1) return setError(iter, expr.toIterate, "Range for-loop can only assign to 1 variable");

		const range    = expr.toIterate;
		const rangeVar = expr.varNames[0];

		const startResult = evaluateExpressionValue(range.lo, iter);
		if (!startResult)                       return RETURN_ERROR;
		if (startResult.type !== Result_Number) return setError(iter, range.lo, "For loop range start needs to be a number");
	
		setOrCreateVar(iter, rangeVar.name, startResult);

		outer: while (true) {
			const endResult = evaluateExpressionValue(range.hi, iter);
			if (!endResult)                       return RETURN_ERROR;
			if (endResult.type !== Result_Number) return setError(iter, range.hi, "For loop range end needs to be a number");

			const endVal    = endResult.val;
			let nextLoopVal = startResult.val;

			switch (range.rangeType) {
				case ast.RANGE_LT: {
					if (nextLoopVal >= endVal) break outer;
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
					assertNever(range.rangeType);
				}
			}

			const rt = evaluateExpressionBlock(expr.statements, iter);
			if (rt === RETURN_ERROR) return RETURN_ERROR;

			startResult.val = nextLoopVal;

			const ls = evaluateLoopStatementReturn(iter, rt);
			if (ls === LOOP_BREAK)    break;
			if (ls === LOOP_CONTINUE) continue;
			if (ls === LOOP_RETURN)   return RETURN_ERROR;
		}

		return RETURN_NONE;
	}

	const toIterate = evaluateExpressionValue(expr.toIterate, iter);
	if (!toIterate) return RETURN_ERROR;
	if (toIterate.type === Result_List) {
		if (expr.varNames.length !== 1 && expr.varNames.length !== 2) {
			return setError(iter, expr, "List iterator needs 1 or 2 loop vars (val, idx)");
		}

		const list = toIterate.val;
		for (let i = 0; i < list.length; i++) {
			const val = list[i];

			setOrCreateVar(iter, expr.varNames[0].name, val);
			if (expr.varNames.length === 2) {
				setOrCreateVar(iter, expr.varNames[1].name, newNumber(i));
			}

			const rt = evaluateExpressionBlock(expr.statements, iter);
			if (rt === RETURN_ERROR) return RETURN_ERROR;
			const ls = evaluateLoopStatementReturn(iter, rt);
			if (ls === LOOP_BREAK)    break;
			if (ls === LOOP_CONTINUE) continue;
			if (ls === LOOP_RETURN)   return RETURN_ERROR;
		}

		return RETURN_NONE;
	}

	if (toIterate.type === Result_Map) {
		if (expr.varNames.length !== 2) {
			return setError(iter, expr, "List iterator needs 2 loop vars (k, v)");
		}

		const map = toIterate.val;
		for (const [, v] of map) {
			setOrCreateVar(iter, expr.varNames[0].name, v.key);
			setOrCreateVar(iter, expr.varNames[1].name, v.val);
			
			const rt = evaluateExpressionBlock(expr.statements, iter);
			if (rt === RETURN_ERROR) return RETURN_ERROR;
			const ls = evaluateLoopStatementReturn(iter, rt);
			if (ls === LOOP_BREAK)    break;
			if (ls === LOOP_CONTINUE) continue;
			if (ls === LOOP_RETURN)   return RETURN_ERROR;
		}

		return RETURN_NONE;
	}

	return setError(iter, expr.toIterate, "Can't iterate an expression of type " + resultTypeToString(toIterate.type));
}

function evaluateIndexer(expr: ast.Indexer, iter: ProgramIterator): ExprReturn {
	const targetResult = evaluateExpressionValue(expr.target, iter);
	if (!targetResult) return RETURN_ERROR;

	const target = asIndexableResult(targetResult);
	if (!target) {
		return setError(iter, expr.target, "Expression can't be indexed: " + ast.expressionToString(iter.program.code, expr.target));
	}

	switch (target.type) {
		case Result_String: {
			const index = evaluateExpressionValue(expr.indexes[0], iter);
			if (!index)                                          return RETURN_ERROR;
			if (index.type !== Result_Number)                    return setError(iter, expr.indexes[0], "String index should be a number");
			if (index.val < 0 || index.val >= target.val.length) return setError(iter, expr.indexes[0], `Index [${index.val}] out-of-bounds (${target.val.length})`);

			return setResultString(iter, target.val[index.val]);
		} break;
		case Result_List: {
			const indexResult = evaluateExpressionValue(expr.indexes[0], iter);
			if (!indexResult) return RETURN_ERROR;
			if (indexResult.type !== Result_Number) {
				return setError(iter, expr.indexes[0], "List indexer needs to be a number");
			}

			const index = Math.floor(indexResult.val);
			if (index < 0 || index >= target.val.length) {
				return setError(iter, expr.indexes[0], "Index was out of bounds: " + index + "/" + target.val.length);
			}

			const value = target.val[index];
			return setResult(iter, value);
		} break;
		case Result_Map: {
			const indexResult = evaluateExpressionValue(expr.indexes[0], iter);
			if (!indexResult) return RETURN_ERROR;

			const key = getMapKey(indexResult);
			if (key === undefined) {
				return setError(iter, expr.indexes[0], "Invalid map key");
			}

			const val = target.val.get(key);
			if (val === undefined) return setResult(iter, NOTHING);
			return setResult(iter, val.val);
		} break;
		case Result_Vector: {
			const index = evaluateExpressionValue(expr.indexes[0], iter);
			if (!index)                                          return RETURN_ERROR;
			if (index.type !== Result_Number)                    return setError(iter, expr.indexes[0], "Vector index should be a number");
			if (index.val < 0 || index.val >= target.val.length) return setError(iter, expr.indexes[0], `Index [${index.val}] out-of-bounds (${target.val.length})`);

			return setResultNumber(iter, target.val[index.val]);
		} break;
		case Result_Matrix: {
			if (expr.indexes.length === 1) {
				const index = evaluateExpressionValue(expr.indexes[0], iter);
				if (!index)                                        return RETURN_ERROR;
				if (index.type !== Result_Number)                  return setError(iter, expr.indexes[0], "Matrix index should be a number");
				if (index.val < 0 || index.val >= target.val.cols) return setError(iter, expr.indexes[0], `Index [${index.val}] out-of-bounds (${target.val.cols} cols)`);

				const result: ResultVector = {
					type: Result_Vector,
					val: Array(target.val.rows).fill(0),
				};
				for (let i = 0; i < result.val.length; i++) {
					const idx = matrixGetIndex(target.val, i, index.val);
					result.val[i] = target.val.data[idx];
				}

				return setResult(iter, result);
			} 

			if (expr.indexes.length === 2) {
				const row = evaluateExpressionValue(expr.indexes[0], iter);
				if (!row) return RETURN_ERROR;
				if (row.type !== Result_Number) return setError(iter, expr.indexes[0], "Matrix row should be a number");
				if (row.val < 0 || row.val >= target.val.rows) return setError(iter, expr.indexes[0], `Index [${row.val}] out-of-bounds (${target.val.rows} rows)`);

				const col = evaluateExpressionValue(expr.indexes[1], iter);
				if (!col) return RETURN_ERROR;
				if (col.type !== Result_Number) return setError(iter, expr.indexes[1], "Matrix column should be a number");
				if (col.val < 0 || col.val >= target.val.cols) return setError(iter, expr.indexes[0], `Index [${col.val}] out-of-bounds (${target.val.cols} rows)`);

				const idx = matrixGetIndex(target.val, row.val, col.val);
				return setResultNumber(iter, target.val.data[idx]);
			}

			return setError(iter, expr, "Too many index expressions for this matrix, just do [columnIdx] or [rowIdx, colIdx]");
		} break;
		default: assertNever(target);
	}
}

function evaluateTypeInitializer(expr: ast.TypeInitializer, iter: ProgramIterator): ExprReturn {
	switch (expr.typename.name) {
		case "list": {
			const result: Result = { type: Result_List, val: [] };

			for (const arg of expr.args) {
				const argEvaluated = evaluateExpressionValue(arg, iter);
				if (!argEvaluated) return RETURN_ERROR;
				result.val.push(argEvaluated);
			}

			return setResult(iter, result);
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
					return setError(iter, arg, "Maps should be initialized like { key=value, key=value, etc. }");
				} 

				const key = evaluateExpressionValue(arg.lhs, iter);
				if (!key) return RETURN_ERROR;

				const val = evaluateExpressionValue(arg.rhs, iter);
				if (!val) return RETURN_ERROR;

				if (setMapKey(iter, result, key, arg.lhs, val, true) === RETURN_ERROR) return RETURN_ERROR;
			}

			return setResult(iter, result);
		} break;
		case "vec": {
			const result: Result = { type: Result_Vector, val: [] };

			for (const arg of expr.args) {
				const val = evaluateExpressionValue(arg, iter);
				if (!val)                       return RETURN_ERROR;
				if (val.type !== Result_Number) return setError(iter, arg, "Vectors can only be initialized with numbers");
				result.val.push(val.val);
			}

			return setResult(iter, result);
		} break;
		case "mat": {
			if (!expr.typeArgs)                                         return setError(iter, expr, "Need type args, e.g mat<3, 4>");
			if (expr.typeArgs.length !== 2)                             return setError(iter, expr, "Need 2 type args, e.g mat<3, 4>");
			if (expr.typeArgs[0].type !== ast.Expression_NumberLiteral) return setError(iter, expr.typeArgs[0], "Need 2 numeric type args, e.g mat<3, 4>");
			if (expr.typeArgs[1].type !== ast.Expression_NumberLiteral) return setError(iter, expr.typeArgs[1], "Need 2 numeric type args, e.g mat<3, 4>");

			const rows = expr.typeArgs[0].val;
			const cols = expr.typeArgs[1].val;

			if (expr.args.length !== rows * cols && expr.args.length !== 1) {
				return setError(iter, expr, `Need to initialize the matrix with exactly 1 or ${rows * cols} values`);
			}
			
			const result: Result = {
				type: Result_Matrix,
				val: {
					rows: rows,
					cols: cols,
					data: Array(rows * cols).fill(0),
				},
			};

			if (expr.args.length === 1) {
				const diagonalValue = evaluateExpressionValue(expr.args[0], iter);
				if (!diagonalValue)                       return RETURN_ERROR;
				if (diagonalValue.type !== Result_Number) return setError(iter, expr.args[0], "Matrix diagonal can only be initialized with numbers");
				
				const minSize = Math.min(rows, cols);
				for (let i = 0; i < minSize; i++) {
					const idx = matrixGetIndex(result.val, i, i);
					result.val.data[idx] = diagonalValue.val;
				}
			} else {
				for (let i = 0; i < expr.args.length; i++) {
					const arg = expr.args[i];
					const val = evaluateExpressionValue(arg, iter);
					if (!val)                       return RETURN_ERROR;
					if (val.type !== Result_Number) return setError(iter, arg, "Matrix element can only be initialized with numbers");
					result.val.data[i] = val.val;
				}
			}

			return setResult(iter, result);
		} break;
	}

	return setError(iter, expr, `Don't know how to initialize this type: ${expr.typename.name}`);
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

export function setMapKey(
	iter: ProgramIterator,
	map: ResultMap,
	key: Result, keyExpr: ast.Expression,
	val: Result, 
	avoidDuplicates=false
): ExprReturn {
	const validMapKey = getMapKey(key)
	if (validMapKey === undefined) {
		return setError(iter, keyExpr, `type ${resultTypeToString(key.type)} can't be used as a map key`);
	}

	if (avoidDuplicates && map.val.has(validMapKey)) {
		return setError(iter, keyExpr, "Map initializer cannot contain duplicate keys");
	}

	map.val.set(validMapKey, { key: key, val: val });
	return RETURN_NONE;
}

export function resultToString(result: Result): string {
	switch (result.type) {
		case Result_Nothing:  return "<nothing>";
		case Result_Number:   return "" + result.val;
		case Result_String:   return result.val;
		case Result_Boolean:  return "" + result.val;
		// TODO: consider making it possible to know the name of the function when we do <ident> = fn() {...}
		case Result_Function: return "fn (" + result.val.args.map(a => a.name).join(", ") + ")"; 
		case Result_BuiltinFunction: return "builtin fn " + result.val.name + ""; 
		case Result_List:     return "list[" + result.val.map(resultToString).join(", ") + "]";
		case Result_Map:      return "map[" + [...result.val.values()].map((e) => resultToString(e.key) + " -> " + resultToString(e.val)).join(", ") + "]";
		case Result_Vector:   return "vec[" + result.val.map(v => "" + v).join(", ") + "]";
		case Result_Matrix:   return "mat[" + matrixValuesToString(result.val) + "\n]";
		default: assertNever(result);
	}
	return "unknown string representation";
}

////////////////////////////////////////////////////
// Builtins

export function print(fn: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	const sb: string[] = [];
	for (let i = 0; i < fn.arguments.length; i++) {
		const expr = fn.arguments[i];

		evaluateExpression(expr, iter);

		let message;
		if (iter.lastResult.error) {
			message = iter.lastResult.error.message;
		} else {
			message = resultToString(iter.lastResult.result);
		}

		sb.push(message);
	}

	iter.logs.push({ expr: fn, text: sb.join(" ") });
	return RETURN_NONE;
}

function evaluateArgumentNumber(call: ast.FunctionCall, i: number, iter: ProgramIterator): ResultNumber | undefined {
	const result = evaluateExpressionValue(call.arguments[i], iter);
	if (!result)                       return undefined;
	if (result.type !== Result_Number) {
		setError(iter, call, `Argument ${i} was not a number`); 
		return;
	}

	return result;
}

export function math_max(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	let max = -Infinity;
	for (let i = 0; i < call.arguments.length; i++) {
		const iArg = evaluateArgumentNumber(call, i, iter);
		if (!iArg) return RETURN_ERROR;
		if (iArg.val > max) max = iArg.val;
	}
	return setResultNumber(iter, max);
}


export function math_min(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	let min = Infinity;
	for (let i = 0; i < call.arguments.length; i++) {
		const iArg = evaluateArgumentNumber(call, i, iter);
		if (!iArg) return RETURN_ERROR;
		if (iArg.val < min) min = iArg.val;
	}
	return setResultNumber(iter, min);
}

function checkNumArgs(call: ast.FunctionCall, fnName: string, numArgs: number, iter: ProgramIterator): boolean {
	if (call.arguments.length !== numArgs) {
		setError(iter, call, fnName + ` requires ${numArgs} arguments`);
		return false;
	}
	return true;
}

export function math_clamp(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_clamp", 3, iter)) return RETURN_ERROR;

	const val = evaluateArgumentNumber(call, 0, iter);
	if (!val) return RETURN_ERROR;

	const min = evaluateArgumentNumber(call, 1, iter);
	if (!min) return RETURN_ERROR;

	const max = evaluateArgumentNumber(call, 2, iter);
	if (!max) return RETURN_ERROR;

	let clamped = val.val;
	if (clamped < min.val) clamped = min.val;
	if (clamped > max.val) clamped = max.val;

	return setResultNumber(iter, clamped);
}

export function math_sin(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_sin", 1, iter))                      return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.sin(rad.val))
}

export function math_cos(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_cos", 1, iter))                      return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.cos(rad.val))
}

export function math_tan(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_tan", 1, iter))                      return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.tan(rad.val))
}

export function math_asin(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_asin", 1, iter))                     return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.asin(rad.val))
}

export function math_acos(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_acos", 1, iter))                     return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.acos(rad.val))
}

export function math_atan(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_atan", 1, iter))                    return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.atan(rad.val))
}

export function math_atan2(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_atan2", 2, iter))                    return RETURN_ERROR;

	const y = evaluateArgumentNumber(call, 0, iter);
	if (!y) return RETURN_ERROR;

	const x = evaluateArgumentNumber(call, 1, iter);
	if (!x) return RETURN_ERROR;

	return setResultNumber(iter, Math.atan2(y.val, x.val))
}

export function math_log2(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_log2", 1, iter))                    return RETURN_ERROR;
	const x = evaluateArgumentNumber(call, 0, iter);
	if (!x) return RETURN_ERROR;
	return setResultNumber(iter, Math.log2(x.val));
}

export function math_ln(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_ln", 1, iter))                    return RETURN_ERROR;
	const x = evaluateArgumentNumber(call, 0, iter);
	if (!x) return RETURN_ERROR;
	return setResultNumber(iter, Math.log(x.val));
}

export function math_pow(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_pow", 2, iter)) return RETURN_ERROR;
	const val = evaluateArgumentNumber(call, 0, iter)
	if (!val) return RETURN_ERROR;

	const power = evaluateArgumentNumber(call, 1, iter)
	if (!power) return RETURN_ERROR;

	return setResultNumber(iter, Math.pow(val.val, power.val));
}

export function math_sqrt(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "math_sqrt", 1, iter))                   return RETURN_ERROR;
	const val = evaluateArgumentNumber(call, 0, iter)
	if (!val) return RETURN_ERROR;
	return setResultNumber(iter, Math.sqrt(val.val));
}

export function mul(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "mul", 2, iter)) return RETURN_ERROR;

	const a0 = evaluateExpressionValue(call.arguments[0], iter);
	if (!a0) return RETURN_ERROR;

	const a1 = evaluateExpressionValue(call.arguments[1], iter);
	if (!a1) return RETURN_ERROR;

	if (a0.type === Result_Matrix && a1.type === Result_Vector) {
		if (a0.val.cols !== a1.val.length) return setError(iter, call, "m1.cols !== vec.length");

		const result: Result = {
			type: Result_Vector,
			val:  Array(a0.val.cols).fill(0),
		};

		for (let a1Row = 0; a1Row < a0.val.rows; a1Row++) {
			let sum = 0;
			for (let k = 0; k < a0.val.cols; k++) {
				const a1Idx = matrixGetIndex(a0.val, a1Row, k);
				sum += a0.val.data[a1Idx] * a1.val[k];
			}
			result.val[a1Row] = sum;
		}

		return setResult(iter, result);
	}

	if (a0.type === Result_Matrix && a1.type === Result_Matrix) {
		if (a0.val.cols !== a1.val.rows) return setError(iter, call, "m1.cols !== m2.rows");

		const result: Result = {
			type: Result_Matrix,
			val: {
				rows: a0.val.rows,
				cols: a1.val.cols,
				data: Array(a0.val.cols * a1.val.rows).fill(0),
			}
		};

		for (let a1Row = 0; a1Row < a0.val.rows; a1Row++) {
			for (let a2Col = 0; a2Col < a1.val.cols; a2Col++) {
				let sum = 0;
				for (let k = 0; k < a0.val.cols; k++) {
					const a1Idx = matrixGetIndex(a0.val, a1Row, k);
					const a2Idx = matrixGetIndex(a1.val, k, a2Col);
					sum += a0.val.data[a1Idx] * a1.val.data[a2Idx];
				}
				const resultIdx = matrixGetIndex(result.val, a1Row, a2Col);
				result.val.data[resultIdx] = sum;
			}
		}

		return setResult(iter, result);
	}

	return setError(iter, call, "mul only handles Matrix x Matrix or Matrix x Vector");
}

export function transpose(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn  {
	if (!checkNumArgs(call, "transpose", 1, iter)) return RETURN_ERROR;
	const m = evaluateExpressionValue(call.arguments[0], iter);
	if (!m)                       return RETURN_ERROR;
	if (m.type !== Result_Matrix) return RETURN_ERROR;

	const result: Result = {
		type: Result_Matrix,
		val: {
			rows: m.val.cols,
			cols: m.val.rows,
			data: Array(m.val.rows * m.val.cols).fill(0),
		}
	};

	for (let row = 0; row < m.val.rows; row++) {
		for (let col = 0; col < m.val.cols; col++) {
			const srcIdx = matrixGetIndex(m.val, row, col);
			const dstIdx = matrixGetIndex(result.val, col, row);
			result.val.data[dstIdx] = m.val.data[srcIdx];
		}
	}

	return setResult(iter, result);
}

export function inverse(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn  {
	if (!checkNumArgs(call, "transpose", 1, iter)) return RETURN_ERROR;

	const mR = evaluateExpressionValue(call.arguments[0], iter);
	if (!mR)                         return RETURN_ERROR;
	if (mR.type !== Result_Matrix)   return setError(iter, call, "Need a matrix");
	if (mR.val.rows !== mR.val.cols) return setError(iter, call, "Only square matrices are invertible");

	const result: Result = {
		type: Result_Matrix,
		val: {
			rows: mR.val.rows,
			cols: mR.val.cols,
			data: Array(mR.val.rows * mR.val.cols).fill(0),
		}
	};

	switch (mR.val.rows) {
		case 1: {
			result.val.data[0] = 1 / result.val.data[0]
		} break;
		case 2: {
			const aIdx = matrixGetIndex(result.val, 0, 0)
			const bIdx = matrixGetIndex(result.val, 0, 1)
			const cIdx = matrixGetIndex(result.val, 1, 0)
			const dIdx = matrixGetIndex(result.val, 1, 1)

			const a = mR.val.data[aIdx];
			const b = mR.val.data[bIdx];
			const c = mR.val.data[cIdx];
			const d = mR.val.data[dIdx];

			const det =  a * d - (b * c);
			result.val.data[aIdx] = d / det;
			result.val.data[bIdx] = -b / det;
			result.val.data[cIdx] = -c / det;
			result.val.data[dIdx] = a / det;
		} break;
		case 3: {
			// TODO: learn abt how this works - ai wrote this

			const aIdx = matrixGetIndex(result.val, 0, 0); const bIdx = matrixGetIndex(result.val, 0, 1); const cIdx = matrixGetIndex(result.val, 0, 2);
			const dIdx = matrixGetIndex(result.val, 1, 0); const eIdx = matrixGetIndex(result.val, 1, 1); const fIdx = matrixGetIndex(result.val, 1, 2);
			const gIdx = matrixGetIndex(result.val, 2, 0); const hIdx = matrixGetIndex(result.val, 2, 1); const iIdx = matrixGetIndex(result.val, 2, 2);

			const a = result.val.data[aIdx]; const b = result.val.data[bIdx]; const c = result.val.data[cIdx];
			const d = result.val.data[dIdx]; const e = result.val.data[eIdx]; const f = result.val.data[fIdx];
			const g = result.val.data[gIdx]; const h = result.val.data[hIdx]; const i = result.val.data[iIdx];

			const A = (e * i - h * f);
			const B = (f * g - d * i);
			const C = (d * h - g * e);

			const det = a * A + b * B + c * C;
			if (Math.abs(det) < 0.00001) {
				return setError(iter, call.arguments[0], "Matrix doesn't have an inverse");
			}

			const invDet = 1.0 / det;

			result.val.data[0] = A * invDet; result.val.data[1] = (c * h - b * i) * invDet; result.val.data[2] = (b * f - c * e) * invDet;
			result.val.data[3] = B * invDet; result.val.data[4] = (a * i - c * g) * invDet; result.val.data[5] = (d * c - a * f) * invDet;
			result.val.data[6] = C * invDet; result.val.data[7] = (g * b - a * h) * invDet; result.val.data[8] = (a * e - d * b) * invDet;
		} break;
		case 4: {
			// TODO: learn abt how this works - ai wrote this

			const m = mR.val.data;
			const inv = result.val.data;
			let det = 0;

			// First column cofactors
			inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] +
					 m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];

			inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] -
					 m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];

			inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] +
					 m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];

			inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] -
					  m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];

			// Second column cofactors
			inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] -
					 m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];

			inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] +
					 m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];

			inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] -
					 m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];

			inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] +
					  m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];

			// Third column cofactors
			inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] +
					 m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];

			inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] -
					 m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];

			inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] +
					  m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];

			inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] -
					  m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];

			// Fourth column cofactors
			inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] -
					 m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];

			inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] +
					 m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];

			inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] -
					  m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];

			inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] +
					  m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

			// Calculate the determinant
			det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];

			// If the matrix is singular, error out
			if (det == 0) {
				return setError(iter, call.arguments[0], "This matrix has no inverse");
			}

			// Multiply adjoint by the determinant
			for (let i = 0; i < 16; i++) {
				inv[i] = inv[i] * det;
			}
		} break;
		// TODO: LU decomposition (but we dont care too much about the larger matrices yet though)
		default: return setError(iter, call.arguments[0], "We dont support inverting a matrix larger than 4, sorry");
	}

	for (let row = 0; row < mR.val.rows; row++) {
		for (let col = 0; col < mR.val.cols; col++) {
			const srcIdx = matrixGetIndex(mR.val, row, col);
			const dstIdx = matrixGetIndex(result.val, col, row);
			result.val.data[dstIdx] = mR.val.data[srcIdx];
		}
	}

	return setResult(iter, result);
}

export function len(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "len", 1, iter)) return RETURN_ERROR;

	const val = evaluateExpressionValue(call.arguments[0], iter);
	if (!val) return RETURN_ERROR;

	if (val.type === Result_String) return setResultNumber(iter, val.val.length);
	if (val.type === Result_List)   return setResultNumber(iter, val.val.length);
	if (val.type === Result_Map)    return setResultNumber(iter, val.val.size);

	return setError(iter, call, "Can't get the length of a " + resultTypeToString(val.type));
}

export function evaluateList(expr: ast.Expression, iter: ProgramIterator): ResultList | undefined {
	const list = evaluateExpressionValue(expr, iter);
	if (!list) return;
	if (list.type !== Result_List) {
		setExpectedValueTypeError(iter, expr, Result_List, list.type);
		return;
	}

	return list;
}

export function push(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (call.arguments.length < 2) return setError(iter, call, "Need a list, and then items to push to it. push(list, val1, val2, val3, ....)");

	const list = evaluateList(call.arguments[0], iter);
	if (!list) return RETURN_ERROR;

	for (let i = 1; i < call.arguments.length; i++) {
		const arg = call.arguments[i];

		const val = evaluateExpressionValue(arg, iter);
		if (!val) return RETURN_ERROR;

		list.val.push(val);
	}

	return RETURN_NONE;
}

export function pop(call: ast.FunctionCall, iter: ProgramIterator): ExprReturn {
	if (!checkNumArgs(call, "pop", 1, iter)) return RETURN_ERROR;

	const list = evaluateList(call.arguments[0], iter);
	if (!list) return RETURN_ERROR;

	let val = list.val.pop();
	if (!val) {
		val = NOTHING;
	}

	return setResult(iter, val);
}


function setExpectedValueTypeError(iter: ProgramIterator, expr: ast.Expression, wanted: ResultType, got: ResultType): ExprReturn {
	console.log(expr)
	return setError(
		iter,
		expr,
		"Expected a " + resultTypeToString(wanted) + 
		" but got a " + resultTypeToString(got) + " instead"
	);
}

export const builtins: Record<string, Result> = {
	// Constants
	"nothing":    NOTHING, 

	// Output
	"print":      { type: Result_BuiltinFunction, val: print },

	// Datastructures
	"len":        { type: Result_BuiltinFunction, val: len },
	"push":       { type: Result_BuiltinFunction, val: push },

	// Maths
	"max":   { type: Result_BuiltinFunction, val: math_max },
	"min":   { type: Result_BuiltinFunction, val: math_min },
	"clamp": { type: Result_BuiltinFunction, val: math_clamp },
	"sin":   { type: Result_BuiltinFunction, val: math_sin },
	"cos":   { type: Result_BuiltinFunction, val: math_cos },
	"tan":   { type: Result_BuiltinFunction, val: math_tan },
	"asin":  { type: Result_BuiltinFunction, val: math_asin },
	"acos":  { type: Result_BuiltinFunction, val: math_acos },
	"atan":  { type: Result_BuiltinFunction, val: math_atan },
	"atan2": { type: Result_BuiltinFunction, val: math_atan2 },
	"log2":  { type: Result_BuiltinFunction, val: math_log2 },
	"ln":    { type: Result_BuiltinFunction, val: math_ln },
	"pow":   { type: Result_BuiltinFunction, val: math_pow },
	"sqrt":  { type: Result_BuiltinFunction, val: math_sqrt },

	// Matrices/Vectors
	"mul":        { type: Result_BuiltinFunction, val: mul },
	"transpose":  { type: Result_BuiltinFunction, val: transpose },
	"inverse":    { type: Result_BuiltinFunction, val: inverse },
}

export function getBuiltin(name: string): Result | undefined {
	return builtins[name];
}
