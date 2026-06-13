import * as pl2 from "./interpreter";
import * as ast from "./ast";

export type BuiltinFn = (fn: ast.FunctionCall, iter: pl2.ProgramIterator) => [pl2.Result, pl2.EvaluateError];

export function getBuiltinFn(name: string): BuiltinFn | undefined {
	switch (name) {
		case "print": return print;
	}

	return undefined;
}

export function print(fn: ast.FunctionCall, iter: pl2.ProgramIterator): [pl2.Result, pl2.EvaluateError] {
	const sb: string[] = [];
	for (let i = 0; i < fn.arguments.length; i++) {
		const expr = fn.arguments[i];
		const [val, err] = pl2.evaluateExpression(expr, iter);

		let message;
		if (err) {
			message = err.reason;
		} else {
			message = pl2.resultToString(val);
		}

		sb.push(message);
	}

	iter.logs.push({ expr: fn, text: sb.join(" ") });

	return [pl2.NOTHING, null]
}
