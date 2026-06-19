import {
	FunctionCall
} from "./ast";
import {
    RETURN_ERR,
	evaluateExpression,
	evaluateExpressionValue,
	ExprNoReturn,
	ExprReturn,
	ExprValueReturn,
	newSlot,
	RETURN_NONE,
	ProgramIterator,
	Result_Number,
	ResultNumber,
	resultToString,
    setError,
    setResultNumber,
    Slot,
    Result_String,
    Result_List,
    Result_Map,
    resultTypeToString,
    Result_Matrix,
    Result,
    matrixGetIdx,
    setResult,
    Result_Vector
} from "./interpreter";

export type BuiltinFn = (fn: FunctionCall, iter: ProgramIterator, dst: Slot) => ExprReturn;

export function getBuiltinFn(name: string): BuiltinFn | undefined {
	switch (name) {
		case "print":      return print;
		case "len":        return len;
		case "math_max":   return math_max;
		case "math_min":   return math_min;
		case "math_clamp": return math_clamp;
		case "math_sin":   return math_sin;
		case "math_cos":   return math_cos;
		case "math_tan":   return math_tan;
		case "math_asin":  return math_asin;
		case "math_acos":  return math_acos;
		case "math_atan":  return math_atan;
		case "math_atan2": return math_atan2;
		case "math_log2":  return math_log2;
		case "math_ln":    return math_ln;
		case "math_pow":   return math_pow;
		case "math_sqrt":  return math_sqrt;
		case "mul":        return mul;

		// TODO: drawing
	}

	return undefined;
}

export function print(fn: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	const sb: string[] = [];
	for (let i = 0; i < fn.arguments.length; i++) {
		const expr = fn.arguments[i];

		const dst = newSlot();
		evaluateExpression(expr, iter, dst);

		let message;
		if (dst.error) {
			message = dst.error;
		} else {
			message = resultToString(dst.result);
		}

		sb.push(message);
	}

	iter.logs.push({ expr: fn, text: sb.join(" ") });
	return RETURN_NONE;
}

function evaluateArgumentNumber(call: FunctionCall, i: number, iter: ProgramIterator, dst: Slot): ExprValueReturn {
	const rt = evaluateExpressionValue(call.arguments[i], iter, dst);
	if (rt === RETURN_ERR) return RETURN_ERR;
	if (dst.result.type !== Result_Number) return setError(dst, `Argument ${i} was not a number`);
	return rt;
}

export function math_max(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprValueReturn {
	let max = -Infinity;
	for (let i = 0; i < call.arguments.length; i++) {
		if (evaluateArgumentNumber(call, i, iter, dst) === RETURN_ERR) return RETURN_ERR;
		if ((dst.result as ResultNumber).val > max) max = (dst.result as ResultNumber).val;
	}
	return setResultNumber(dst, max);
}


export function math_min(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprValueReturn {
	let min = Infinity;
	for (let i = 0; i < call.arguments.length; i++) {
		if (evaluateArgumentNumber(call, i, iter, dst) === RETURN_ERR) return RETURN_ERR;
		if ((dst.result as ResultNumber).val < min) min = (dst.result as ResultNumber).val;
	}
	return setResultNumber(dst, min);
}

function checkNumArgs(call: FunctionCall, fnName: string, numArgs: number, dst: Slot): ExprNoReturn | undefined {
	if (call.arguments.length !== numArgs) return setError(dst, fnName + ` requires ${numArgs} arguments`);
	return undefined;
}

export function math_clamp(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_clamp", 3, dst))   return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;

	const minDst = iter.temp1;
	if (evaluateArgumentNumber(call, 1, iter, minDst) === RETURN_ERR) return setError(dst, minDst.error);

	const maxDst = iter.temp2;
	if (evaluateArgumentNumber(call, 2, iter, maxDst) === RETURN_ERR) return setError(dst, maxDst.error);

	let clamped = (dst.result as ResultNumber).val;
	if (clamped < (minDst.result as ResultNumber).val) clamped = (minDst.result as ResultNumber).val;
	if (clamped > (maxDst.result as ResultNumber).val) clamped = (maxDst.result as ResultNumber).val;

	return setResultNumber(dst, clamped);
}

export function math_sin(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_sin", 1, dst))     return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.sin((dst.result as ResultNumber).val))
}

export function math_cos(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_cos", 1, dst))     return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.cos((dst.result as ResultNumber).val))
}

export function math_tan(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_tan", 1, dst))                    return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.tan((dst.result as ResultNumber).val))
}

export function math_asin(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_asin", 1, dst))                    return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.asin((dst.result as ResultNumber).val))
}

export function math_acos(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_acos", 1, dst))                    return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.acos((dst.result as ResultNumber).val))
}

export function math_atan(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_atan", 1, dst))                    return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.atan((dst.result as ResultNumber).val))
}

export function math_atan2(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_atan2", 2, dst))                  return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, iter.temp1) === RETURN_ERR) return setError(dst, iter.temp1.error);
	if (evaluateArgumentNumber(call, 1, iter, iter.temp2) === RETURN_ERR) return setError(dst, iter.temp2.error);
	return setResultNumber(dst, Math.atan2((iter.temp1.result as ResultNumber).val, (iter.temp2.result as ResultNumber).val))
}

export function math_log2(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_log2", 1, dst))                    return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.log2((dst.result as ResultNumber).val));
}

export function math_ln(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_ln", 1, dst))                    return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.log((dst.result as ResultNumber).val));
}

export function math_pow(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_pow", 2, dst))                           return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, iter.temp1) === RETURN_ERR) return setError(dst, iter.temp1.error);
	if (evaluateArgumentNumber(call, 1, iter, iter.temp2) === RETURN_ERR) return setError(dst, iter.temp2.error);
	return setResultNumber(dst, Math.pow((iter.temp1.result as ResultNumber).val, (iter.temp2.result as ResultNumber).val));
}

export function math_sqrt(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "math_sqrt", 1, dst))                   return RETURN_ERR;
	if (evaluateArgumentNumber(call, 0, iter, dst) === RETURN_ERR) return RETURN_ERR;
	return setResultNumber(dst, Math.sqrt((dst.result as ResultNumber).val));
}

export function mul(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "mul", 2, dst)) return RETURN_ERR;
	if (evaluateExpressionValue(call.arguments[0], iter, iter.temp1) === RETURN_ERR) return setError(dst, iter.temp1.error);
	if (evaluateExpressionValue(call.arguments[1], iter, iter.temp2) === RETURN_ERR) return setError(dst, iter.temp2.error);

	const a1 = iter.temp1.result;
	const a2 = iter.temp2.result;

	if (a1.type === Result_Matrix && a2.type === Result_Vector) {
		if (a1.cols !== a2.val.length) return setError(dst, "m1.cols !== vec.length");

		const result: Result = {
			type: Result_Vector,
			val: Array(a1.cols).fill(0),
		};

		for (let a1Row = 0; a1Row < a1.rows; a1Row++) {
			let sum = 0;
			for (let k = 0; k < a1.cols; k++) {
				const a1Idx = matrixGetIdx(a1, a1Row, k);
				sum += a1.val[a1Idx] * a2.val[k];
			}
			result.val[a1Row] = sum;
		}

		return setResult(dst, result);
	}

	if (a1.type === Result_Matrix && a2.type === Result_Matrix) {
		if (a1.cols !== a2.rows) return setError(dst, "m1.cols !== m2.rows");

		const result: Result = {
			type: Result_Matrix,
			rows: a1.rows,
			cols: a2.cols,
			val: Array(a1.cols * a2.rows).fill(0),
		};

		for (let a1Row = 0; a1Row < a1.rows; a1Row++) {
			for (let a2Col = 0; a2Col < a2.cols; a2Col++) {
				let sum = 0;
				for (let k = 0; k < a1.cols; k++) {
					const a1Idx = matrixGetIdx(a1, a1Row, k);
					const a2Idx = matrixGetIdx(a2, k, a2Col);
					sum += a1.val[a1Idx] * a2.val[a2Idx];
				}
				const resultIdx = matrixGetIdx(result, a1Row, a2Col);
				result.val[resultIdx] = sum;
			}
		}

		return setResult(dst, result);
	}

	return setError(dst, "mul only handles Matrix x Matrix or Matrix x Vector");
}

export function len(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "len", 1, dst)) return RETURN_ERR;
	if (evaluateExpressionValue(call.arguments[0], iter, dst) === RETURN_ERR) return RETURN_ERR;
	if (dst.result.type === Result_String) return setResultNumber(dst, dst.result.val.length);
	if (dst.result.type === Result_List)   return setResultNumber(dst, dst.result.val.length);
	if (dst.result.type === Result_Map)    return setResultNumber(dst, dst.result.val.size);
	return setError(dst, "Can't get the length of a " + resultTypeToString(dst.result.type));
}
