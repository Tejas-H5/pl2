import { FunctionCall } from "./ast";
import {
    RETURN_ERROR,
	evaluateExpression,
	evaluateExpressionValue,
	ExprReturn,
	RETURN_NONE,
	ProgramIterator,
	Result_Number,
	ResultNumber,
	resultToString,
    setError,
    setResultNumber,
    Result_String,
    Result_List,
    Result_Map,
    resultTypeToString,
    Result_Matrix,
    Result,
    matrixGetIndex,
    setResult,
    Result_Vector,
} from "./interpreter";

export function print(fn: FunctionCall, iter: ProgramIterator): ExprReturn {
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

function evaluateArgumentNumber(call: FunctionCall, i: number, iter: ProgramIterator): ResultNumber | undefined {
	const result = evaluateExpressionValue(call.arguments[i], iter);
	if (!result)                       return undefined;
	if (result.type !== Result_Number) {
		setError(iter, call, `Argument ${i} was not a number`); 
		return;
	}

	return result;
}

export function math_max(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	let max = -Infinity;
	for (let i = 0; i < call.arguments.length; i++) {
		const iArg = evaluateArgumentNumber(call, i, iter);
		if (!iArg) return RETURN_ERROR;
		if (iArg.val > max) max = iArg.val;
	}
	return setResultNumber(iter, max);
}


export function math_min(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	let min = Infinity;
	for (let i = 0; i < call.arguments.length; i++) {
		const iArg = evaluateArgumentNumber(call, i, iter);
		if (!iArg) return RETURN_ERROR;
		if (iArg.val < min) min = iArg.val;
	}
	return setResultNumber(iter, min);
}

function checkNumArgs(call: FunctionCall, fnName: string, numArgs: number, iter: ProgramIterator): ExprReturn | undefined {
	if (call.arguments.length !== numArgs) return setError(iter, call, fnName + ` requires ${numArgs} arguments`);
	return undefined;
}

export function math_clamp(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_clamp", 3, iter)) return RETURN_ERROR;

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

export function math_sin(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_sin", 1, iter))                      return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.sin(rad.val))
}

export function math_cos(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_cos", 1, iter))                      return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.cos(rad.val))
}

export function math_tan(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_tan", 1, iter))                      return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.tan(rad.val))
}

export function math_asin(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_asin", 1, iter))                     return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.asin(rad.val))
}

export function math_acos(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_acos", 1, iter))                     return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.acos(rad.val))
}

export function math_atan(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_atan", 1, iter))                    return RETURN_ERROR;
	const rad = evaluateArgumentNumber(call, 0, iter);
	if (!rad) return RETURN_ERROR;
	return setResultNumber(iter, Math.atan(rad.val))
}

export function math_atan2(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_atan2", 2, iter))                    return RETURN_ERROR;

	const y = evaluateArgumentNumber(call, 0, iter);
	if (!y) return RETURN_ERROR;

	const x = evaluateArgumentNumber(call, 1, iter);
	if (!x) return RETURN_ERROR;

	return setResultNumber(iter, Math.atan2(y.val, x.val))
}

export function math_log2(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_log2", 1, iter))                    return RETURN_ERROR;
	const x = evaluateArgumentNumber(call, 0, iter);
	if (!x) return RETURN_ERROR;
	return setResultNumber(iter, Math.log2(x.val));
}

export function math_ln(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_ln", 1, iter))                    return RETURN_ERROR;
	const x = evaluateArgumentNumber(call, 0, iter);
	if (!x) return RETURN_ERROR;
	return setResultNumber(iter, Math.log(x.val));
}

export function math_pow(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_pow", 2, iter)) return RETURN_ERROR;
	const val = evaluateArgumentNumber(call, 0, iter)
	if (!val) return RETURN_ERROR;

	const power = evaluateArgumentNumber(call, 1, iter)
	if (!power) return RETURN_ERROR;

	return setResultNumber(iter, Math.pow(val.val, power.val));
}

export function math_sqrt(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "math_sqrt", 1, iter))                   return RETURN_ERROR;
	const val = evaluateArgumentNumber(call, 0, iter)
	if (!val) return RETURN_ERROR;
	return setResultNumber(iter, Math.sqrt(val.val));
}

export function mul(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "mul", 2, iter)) return RETURN_ERROR;

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

export function transpose(call: FunctionCall, iter: ProgramIterator): ExprReturn  {
	if (checkNumArgs(call, "transpose", 1, iter)) return RETURN_ERROR;
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

export function inverse(call: FunctionCall, iter: ProgramIterator): ExprReturn  {
	if (checkNumArgs(call, "transpose", 1, iter)) return RETURN_ERROR;

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

export function len(call: FunctionCall, iter: ProgramIterator): ExprReturn {
	if (checkNumArgs(call, "len", 1, iter)) return RETURN_ERROR;

	const val = evaluateExpressionValue(call.arguments[0], iter);
	if (!val) return RETURN_ERROR;

	if (val.type === Result_String) return setResultNumber(iter, val.val.length);
	if (val.type === Result_List)   return setResultNumber(iter, val.val.length);
	if (val.type === Result_Map)    return setResultNumber(iter, val.val.size);

	return setError(iter, call, "Can't get the length of a " + resultTypeToString(val.type));
}
