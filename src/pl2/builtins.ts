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
		case "transpose":  return transpose;

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

export function transpose(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn  {
	if (checkNumArgs(call, "transpose", 1, dst)) return RETURN_ERR;
	if (evaluateExpressionValue(call.arguments[0], iter, iter.temp1) === RETURN_ERR) return setError(dst, iter.temp1.error);

	const m = iter.temp1.result;
	if (m.type !== Result_Matrix) return RETURN_ERR;

	const result: Result = {
		type: Result_Matrix,
		rows: m.cols,
		cols: m.rows,
		val: Array(m.rows * m.cols).fill(0),
	};

	for (let row = 0; row < m.rows; row++) {
		for (let col = 0; col < m.cols; col++) {
			const srcIdx = matrixGetIdx(m, row, col);
			const dstIdx = matrixGetIdx(result, col, row);
			result.val[dstIdx] = m.val[srcIdx];
		}
	}

	return setResult(dst, result);
}

export function inverse(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn  {
	if (checkNumArgs(call, "transpose", 1, dst)) return RETURN_ERR;
	if (evaluateExpressionValue(call.arguments[0], iter, iter.temp1) === RETURN_ERR) {
		return setError(dst, iter.temp1.error);
	}

	const mR = iter.temp1.result;
	if (mR.type !== Result_Matrix) return setError(dst, "Need a matrix");
	if (mR.rows !== mR.cols)        return setError(dst, "Only square matrices are invertible");

	const result: Result = {
		type: Result_Matrix,
		rows: mR.rows,
		cols: mR.cols,
		val: Array(mR.rows * mR.cols).fill(0),
	};

	switch (mR.rows) {
		case 1: {
			result.val[0] = 1 / result.val[0]
		} break;
		case 2: {
			const aIdx = matrixGetIdx(result, 0, 0)
			const bIdx = matrixGetIdx(result, 0, 1)
			const cIdx = matrixGetIdx(result, 1, 0)
			const dIdx = matrixGetIdx(result, 1, 1)

			const a = mR.val[aIdx];
			const b = mR.val[bIdx];
			const c = mR.val[cIdx];
			const d = mR.val[dIdx];

			const det =  a * d - (b * c);
			result.val[aIdx] = d / det;
			result.val[bIdx] = -b / det;
			result.val[cIdx] = -c / det;
			result.val[dIdx] = a / det;
		} break;
		case 3: {
			// TODO: learn abt how this works - ai wrote this

			const aIdx = matrixGetIdx(result, 0, 0); const bIdx = matrixGetIdx(result, 0, 1); const cIdx = matrixGetIdx(result, 0, 2);
			const dIdx = matrixGetIdx(result, 1, 0); const eIdx = matrixGetIdx(result, 1, 1); const fIdx = matrixGetIdx(result, 1, 2);
			const gIdx = matrixGetIdx(result, 2, 0); const hIdx = matrixGetIdx(result, 2, 1); const iIdx = matrixGetIdx(result, 2, 2);

			const a = result.val[aIdx]; const b = result.val[bIdx]; const c = result.val[cIdx];
			const d = result.val[dIdx]; const e = result.val[eIdx]; const f = result.val[fIdx];
			const g = result.val[gIdx]; const h = result.val[hIdx]; const i = result.val[iIdx];

			const A = (e * i - h * f);
			const B = (f * g - d * i);
			const C = (d * h - g * e);

			const det = a * A + b * B + c * C;
			if (Math.abs(det) < 0.00001) {
				return setError(dst, "Matrix doesn't have an inverse");
			}

			const invDet = 1.0 / det;

			result.val[0] = A * invDet; result.val[1] = (c * h - b * i) * invDet; result.val[2] = (b * f - c * e) * invDet;
			result.val[3] = B * invDet; result.val[4] = (a * i - c * g) * invDet; result.val[5] = (d * c - a * f) * invDet;
			result.val[6] = C * invDet; result.val[7] = (g * b - a * h) * invDet; result.val[8] = (a * e - d * b) * invDet;
		} break;
		case 4: {
			// TODO: learn abt how this works - ai wrote this

			const m = mR.val;
			const inv = result.val;
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
				return setError(dst, "This matrix has no inverse");
			}

			// Multiply adjoint by the determinant
			for (let i = 0; i < 16; i++) {
				inv[i] = inv[i] * det;
			}
		} break;
		default: return setError(dst, "We dont support inverting a matrix larger than 4, sorry");
	}

	for (let row = 0; row < mR.rows; row++) {
		for (let col = 0; col < mR.cols; col++) {
			const srcIdx = matrixGetIdx(mR, row, col);
			const dstIdx = matrixGetIdx(result, col, row);
			result.val[dstIdx] = mR.val[srcIdx];
		}
	}

	return setResult(dst, result);
}

export function len(call: FunctionCall, iter: ProgramIterator, dst: Slot): ExprReturn {
	if (checkNumArgs(call, "len", 1, dst)) return RETURN_ERR;
	if (evaluateExpressionValue(call.arguments[0], iter, dst) === RETURN_ERR) return RETURN_ERR;
	if (dst.result.type === Result_String) return setResultNumber(dst, dst.result.val.length);
	if (dst.result.type === Result_List)   return setResultNumber(dst, dst.result.val.length);
	if (dst.result.type === Result_Map)    return setResultNumber(dst, dst.result.val.size);
	return setError(dst, "Can't get the length of a " + resultTypeToString(dst.result.type));
}
