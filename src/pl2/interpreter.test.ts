import {
	test,
	testFailure,
	addTest,
	addTestGroup,
	setCurrentTestFile,
	testAssert,
	testDeepEqual,
	testEqual,
	TestResult
} from "src/testing/testing";
import { assertNever } from "./assert";
import { expressionToString } from "./ast";
import * as pl2 from "./interpreter";

setCurrentTestFile("src/interpreter.test.ts", pl2.interpretProgram);

type TestCase = {
	name: string;
	program?: string;
	code: string;
	expected: pl2.Result;
};

function addAllTestCases(cases: TestCase[]) {
	for (const testCase of cases) {
		addTest(testCase.name, r => {
			const ctx = pl2.interpretCode(testCase.program ?? "");
			if (testNoErrors(r, ctx)) {
				const [result, err] = pl2.evaluateCode(testCase.code, ctx);
				testEqual(r, err, undefined);
				testEqualResult(r, result, testCase.expected);
			}
		});
	}
}

export function testNoErrors(r: TestResult, p: pl2.ProgramIterator): boolean {
	if (!testEqual(r, p.lastResult.error?.message, undefined)) {
		testFailure(r, "'" + expressionToString(p.program.code, p.lastResult.error!.expr) + "'");
		return false;
	}
	return true;
}

export function testEqualError(r: TestResult, p: pl2.ProgramIterator, expectedError?: string): boolean {
	let result;
	if (expectedError) {
		result = testEqual(r, p.lastResult.error?.message, expectedError);
	} else {
		result = test(r, !!p.lastResult.error?.message);
	}
	return result;
}

function testEqualResult(r: TestResult, got: pl2.Result, wanted: pl2.Result, message = "") {
	if (!test(r, got.type === wanted.type)) {
		testFailure(r, "\nGot   : " + pl2.resultTypeToString(got.type)    + "|" + pl2.resultToString(got) + 
			           "\nWanted: " + pl2.resultTypeToString(wanted.type) + "|" + pl2.resultToString(wanted));
	}
	switch(wanted.type) {
		case pl2.Result_Nothing: {
			testAssert(r, got.type === wanted.type);
		} break;
		case pl2.Result_BuiltinFunction: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val);
		} break;
		case pl2.Result_Number: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val, message);
		} break;
		case pl2.Result_String: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val, message);
		} break;
		case pl2.Result_Boolean: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val, message);
		} break;
		case pl2.Result_Function: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val, message);
		} break;
		case pl2.Result_List: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val.length, wanted.val.length, message);
			for (let i = 0; i < got.val.length; i++) {
				testEqualResult(r, got.val[i], wanted.val[i]);
			}
		} break;
		case pl2.Result_Map: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val.size, wanted.val.size);
			for (const [k, v] of got.val) {
				testEqual(r, v, wanted.val.get(k));
			}
		} break;
		case pl2.Result_Vector: {
			testAssert(r, got.type === wanted.type);
			testDeepEqual(r, got.val, wanted.val);
		} break;
		case pl2.Result_Matrix: {
			testAssert(r, got.type === wanted.type);
			if (testEqual(r, got.val.rows, wanted.val.rows, "rows not equal")) {
				if (testEqual(r, got.val.cols, wanted.val.cols, "cols not equal")) {
					testDeepEqual(r, got.val.data, wanted.val.data);
				}
			}
		} break;
		default: assertNever(wanted);
	}
}

function testEqualLogs(r: TestResult, result: pl2.ProgramIterator, expected: string[]) {
	if (!testEqual(r, result.logOutputs.length, expected.length)) {
		testFailure(r, "Logs: ");
		for (const log of result.logOutputs) {
			testFailure(r, log.text);
		}
		return;
	}

	for (let i = 0; i < expected.length; i++) {
		const line = expected[i];
		const got = result.logOutputs[i].text;
		testEqual(r, got, line, "line " + i);
	}
}

addTestGroup("Binary expressions", [pl2.evaluateBinaryOperation], () => {
	addTestGroup("Assignment", [pl2.evaluateAssignment], () => {
		addTest("Normal assigning", r => {
			const result = pl2.interpretCode("x = 1");

			testNoErrors(r, result);

			const [x, err] = pl2.evaluateCode("x", result);

			testEqual(r, err, undefined);
			testEqualResult(r, x, { type: pl2.Result_Number, val: 1 });
		});

		addTest("Multiple normal assigning", r => {
			const result = pl2.interpretCode(`
				x = 1
				x = 100000000000
				x = 1
				x = 0
				x = 1
				x = 0
				x = 1
			`);

			const [x, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, undefined);
			testEqualResult(r, x, { type: pl2.Result_Number, val: 1 });
		});

		addTestGroup("Increment assigning", [pl2.evaluateAssignment, pl2.evaluateBinaryOperation], () => {
			addTest("Error case", r => {
				const result = pl2.interpretCode("x += 2");
				const [, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, "Variable not found: x");
			});

			addAllTestCases([
				{ code: "x", name: "+= ", program: "x = 0\n     x += 2",      expected: pl2.newNumber(2) },
				{ code: "x", name: "-= ", program: "x = 0\n     x -= 2",      expected: pl2.newNumber(-2) },
				{ code: "x", name: "*= ", program: "x = 2\n     x *= 2",      expected: pl2.newNumber(4) },
				{ code: "x", name: "*= ", program: "x = 2\n     x *= -2",     expected: pl2.newNumber(-4) },
				{ code: "x", name: "%= ", program: "x = 3\n     x %= 2",      expected: pl2.newNumber(1) },
				{ code: "x", name: "&&=", program: "x = true\n  x &&= true",  expected: pl2.newBoolean(true) },
				{ code: "x", name: "&&=", program: "x = false\n x &&= true",  expected: pl2.newBoolean(false) },
				{ code: "x", name: "||=", program: "x = false\n x ||= true",  expected: pl2.newBoolean(true) },
				{ code: "x", name: "||=", program: "x = false\n x ||= false", expected: pl2.newBoolean(false) },
				{ code: "x", name: "^^=", program: "x = false\n x ^^= true",  expected: pl2.newBoolean(true) },
			]);
		});

		addTestGroup("Comparisons", [], () => {
			addAllTestCases([
				{ name: "<",               program: "x = 1 < 2",                      code: "x", expected: pl2.newBoolean(true) },
				{ name: "<",               program: "x = 2 < 2",                      code: "x", expected: pl2.newBoolean(false) },
				{ name: "<=",              program: "x = 1 <= 2",                     code: "x", expected: pl2.newBoolean(true) },
				{ name: "<=",              program: "x = 2 <= 2",                     code: "x", expected: pl2.newBoolean(true) },
				{ name: "<=",              program: "x = 3 <= 2",                     code: "x", expected: pl2.newBoolean(false) },
				{ name: ">",               program: "x = 3 > 2",                      code: "x", expected: pl2.newBoolean(true) },
				{ name: ">",               program: "x = 2 > 2",                      code: "x", expected: pl2.newBoolean(false) },
				{ name: ">=",              program: "x = 3 >= 2",                     code: "x", expected: pl2.newBoolean(true) },
				{ name: ">=",              program: "x = 2 >= 2",                     code: "x", expected: pl2.newBoolean(true) },
				{ name: ">=",              program: "x = 1 >= 2",                     code: "x", expected: pl2.newBoolean(false) },
				{ name: "binary expr lhs", program: "x = 15 % 3 == 0",                code: "x", expected: pl2.newBoolean(true) },
				{ name: "binary expr rhs", program: "x = 15 % 5 == 0",                code: "x", expected: pl2.newBoolean(true) },
				{ name: "complex expr",    program: "x = 15 % 5 == 0 && 15 % 3 == 0", code: "x", expected: pl2.newBoolean(true) },
			]);
		});

		addTestGroup("Scope interactions", [pl2.getVar, pl2.setOrCreateVar, pl2.createVar], () => {
			addTest("New variables should be created in the current scope", r => {
				const result = pl2.interpretCode(`
					do_thing = fn() {
						x = 1
						return(x)
					}
					x = 2
					y = do_thing()
				`);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, undefined);
				testEqualResult(r, x, pl2.newNumber(2))

				const [y, err2] = pl2.evaluateCode("y", result);
				testEqual(r, err2, undefined);
				testEqualResult(r, y, pl2.newNumber(1))
			});

			addTest("Shouldn't be able to mutate variables through function scopes", r => {
				const result = pl2.interpretCode(`
					x = 0
					do_thing = fn() {
						x = 1
						return(x)
					}
					do_thing()
				`);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, undefined);
				testEqualResult(r, x, pl2.newNumber(0));
			});

			addTest("Should NOT be able to access variables through function scopes - they are non-capturing", r => {
				const result = pl2.interpretCode(`
					do_thing = fn() {
						print(i);
					}

					fn test() {
						i = 12
						do_thing()
					}

					do_thing()
				`);

				testEqualLogs(r,result, [
					"Variable not found: i",
				]);
			});

			addTest("Should be able to mutate variables through return block scopes", r => {
				const result = pl2.interpretCode(`
					x = 0
					y = return{
						x = 1
						return nothing
					}
				`);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, undefined);
				testEqualResult(r, x, pl2.newNumber(1));
			});

			addTest("Variables shouldn't leak out of their blokcs", r => {
				const result = pl2.interpretCode(`
					if 1<2 {
						x = 0
					}
				`);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, "Variable not found: x");
			});

			addTest("Global vars should be accessible from all scopes", r => {
				const result = pl2.interpretCode(`
					fn b() {
						a()
					}

					a = fn() {
						print("hi")
					}

					b();
				`);

				testEqual(r, result.lastResult.error, undefined);
				testEqualLogs(r, result, [ "hi" ]);
			});
		});
	})

	addTestGroup("Maths", [pl2.evaluateAssignment], () => {
		addTest("Quick maths", r => {
			const result = pl2.interpretCodeLines([
				"a = 1",
				"b = 1",
				"c = a + b",
			]);

			const [c, err] = pl2.evaluateCode("c", result);
			testEqual(r, err, undefined);
			testEqualResult(r, c, pl2.newNumber(2));
		});

		addTest("Order of ops", r => {
			const result = pl2.interpretCodeLines([
				"x = 2 * 2 + 1",
			]);

			const [c, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, undefined);
			testEqualResult(r, c, pl2.newNumber(5));
		});

		addTest("Order of ops 2", r => {
			const result = pl2.interpretCodeLines([
				"x = 1 + 2 * 2",
			]);

			const [c, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, undefined);
			testEqualResult(r, c, pl2.newNumber(5));
		});

		addTest("Order of ops 2", r => {
			const result = pl2.interpretCodeLines([
				"x = (1 + 2) * 2",
			]);

			const [c, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, undefined);
			testEqualResult(r, c, pl2.newNumber(6));
		});
	});


	addTestGroup("Vector elementwise ops", [pl2.evaluateBinaryOperationOnResults], () => {
		addAllTestCases([
			{ name: `+ `, code: `vec{1, 2, 3}   +  vec{3, 2, 1}`, expected: { type: pl2.Result_Vector, val: [4,  4, 4] }, },
			{ name: `- `, code: `vec{1, 2, 3}   -  vec{3, 2, 1}`, expected: { type: pl2.Result_Vector, val: [-2, 0, 2] }, },
			{ name: `* `, code: `vec{1, 2, 3}   *  vec{3, 2, 1}`, expected: { type: pl2.Result_Vector, val: [3,  4, 3] }, },
			{ name: `/ `, code: `vec{5, 10, 15} /  vec{5, 5, 5}`, expected: { type: pl2.Result_Vector, val: [1, 2, 3] },  },
			{ name: `==`, code: `vec{1,2,3}     == vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [1, 0, 0] },  },
			{ name: `!=`, code: `vec{1,2,3}     != vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [0, 1, 1] },  },
			{ name: `< `, code: `vec{1,2,3}     <  vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [0, 1, 0] },  },
			{ name: `<=`, code: `vec{1,2,3}     <= vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [1, 1, 0] },  },
			{ name: `> `, code: `vec{1,2,3}     >  vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [0, 0, 1] },  },
			{ name: `>=`, code: `vec{1,2,3}     >= vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [1, 0, 1] },  },
		]);
	});

	addTestGroup("Matrix elementwise ops", [pl2.evaluateBinaryOperationOnResults], () => {
		addAllTestCases([
			{ name: "+ ", code: `mat<1, 3>{1, 2, 3}   +  mat<1, 3>{3, 2, 1}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [4,  4, 4] } } },
			{ name: "- ", code: `mat<1, 3>{1, 2, 3}   -  mat<1, 3>{3, 2, 1}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [-2, 0, 2] } } },
			{ name: "* ", code: `mat<1, 3>{1, 2, 3}   *  mat<1, 3>{3, 2, 1}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [3,  4, 3] } } },
			{ name: "/ ", code: `mat<1, 3>{5, 10, 15} /  mat<1, 3>{5, 5, 5}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 2, 3] } } },
			{ name: "==", code: `mat<1, 3>{1,2,3}     == mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 0, 0] } } },
			{ name: "!=", code: `mat<1, 3>{1,2,3}     != mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [0, 1, 1] } } },
			{ name: "< ", code: `mat<1, 3>{1,2,3}     <  mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [0, 1, 0] } } },
			{ name: "<=", code: `mat<1, 3>{1,2,3}     <= mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 1, 0] } } },
			{ name: "> ", code: `mat<1, 3>{1,2,3}     >  mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [0, 0, 1] } } },
			{ name: ">=", code: `mat<1, 3>{1,2,3}     >= mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 0, 1] } } },
		]);
	});

	addTestGroup("Vector scalar ops", [pl2.evaluateBinaryOperationOnResults], () => {
		addAllTestCases([
			{ name: `*`, code: `2 * vec{1, 2, 3}`, expected: { type: pl2.Result_Vector, val: [2, 4, 6] }, },
			{ name: `/`, code: `vec{2, 4, 6} / 2`, expected: { type: pl2.Result_Vector, val: [1, 2, 3] }, },
		]);
	});
})

addTestGroup("Unary operations", [pl2.evaluateUnaryOperation], () => {
	addTestGroup("Booleans", [], () => {
		addAllTestCases([
			{ name: "!false", code: "!false",  expected: { type: pl2.Result_Boolean,  val: true } },
			{ name: "!true", code: "!true",   expected: { type: pl2.Result_Boolean,   val: false } },
			{ name: "!!false", code: "!!false", expected: { type: pl2.Result_Boolean, val: false } },
			{ name: "!!true", code: "!!true",  expected: { type: pl2.Result_Boolean,  val: true } },
		]);
	});

	addTestGroup("Numbers", [], () => {
		addAllTestCases([
			{ name: "!0",  code: "!0",   expected: { type: pl2.Result_Number, val: 1 } },
			{ name: "!1",   code: "!1",  expected: { type: pl2.Result_Number, val: 0 } },
			{ name: "!!0", code: "!!0",  expected: { type: pl2.Result_Number, val: 0 } },
			{ name: "!!1",  code: "!!1", expected: { type: pl2.Result_Number, val: 1 } },
		]);
	});
});

addTestGroup("User functions", [pl2.evaluateFunctionCall], () => {
	addTest("Can define a function", r => {
		const result = pl2.interpretCode(`
			increment = fn(x) {
				return(x + 1)
			}
		`);

		const [val, err2] = pl2.evaluateCode("increment", result);
		testEqual(r, err2, undefined);
		testEqual(r, val.type, pl2.Result_Function);
	});


	addTest("Can call a user-defined function", r => {
		const result = pl2.interpretCode(` increment = fn(x) { return(x + 1) } `);

		const [c, err] = pl2.evaluateCode("increment(2)", result);
		testEqual(r, err, undefined);
		testEqualResult(r, c, pl2.newNumber(3));
	});

	addTest("Provides error when not found", r => {
		const ctx = pl2.interpretCode("")
		const [, err] = pl2.evaluateCode("the_thing()", ctx);
		testEqual(r, err, "Couldn't find function the_thing in this scope");
	});
});

addTestGroup("Builtin functions", [pl2.builtins], () => {
	addTest("print", r => {
		const result = pl2.interpretCode(`
			print(1 + 1)
		`);

		testEqual(r, result.logOutputs.length, 1);
		testEqual(r, result.logOutputs[0].text, "2");
	});

	addAllTestCases([
		{ name: "max 1", code: "x = max(1, 2)",    expected: pl2.newNumber(2) },
		{ name: "max 2", code: "x = max(2, 1)",    expected: pl2.newNumber(2) },
		{ name: "max 3", code: "x = max(0, 1, 3)", expected: pl2.newNumber(3) },
		{ name: "max 4", code: "x = max()",        expected: pl2.newNumber(-Infinity) },

		{ name: "min 1", code: "x = min(1, 2)",    expected: pl2.newNumber(1) },
		{ name: "min 2", code: "x = min(2, 1)",    expected: pl2.newNumber(1) },
		{ name: "min 3", code: "x = min(0, 1, 3)", expected: pl2.newNumber(0) },
		{ name: "min 4", code: "x = min()",        expected: pl2.newNumber(Infinity) },
		
		{ name: "clamp 1", code: "x = clamp(0.5, 0, 1)", expected: pl2.newNumber(0.5) },
		{ name: "clamp 2", code: "x = clamp(-2, 0, 1)",  expected: pl2.newNumber(0) },
		{ name: "clamp 3", code: "x = clamp(2, 0, 1)",   expected: pl2.newNumber(1) },

		{ name: "sin 1", code: "x = sin(0)",   expected: pl2.newNumber(0) },
		{ name: "cos 1", code: "x = cos(0)",   expected: pl2.newNumber(1) },

		{ name: "len string", code: `x = len("abc")`,   expected: pl2.newNumber(3) },

		{ name: "matrix mul",       code: `x = mul(mat<2, 2>{1, 2, 3, 4}, vec{1, 1})`, expected: { type: pl2.Result_Vector, val: [3, 7] } },
		{ name: "matrix transpose", code: `x = matrix_transpose(mat<2, 2>{1, 2, 3, 4})`,      expected: { type: pl2.Result_Matrix, val: { rows: 2, cols: 2, data: [1, 3, 2, 4] } } },

		{ name: "push", program: "x = list{}; push(x, 1)", code: "x", expected: { type: pl2.Result_List, val: [ pl2.newNumber(1) ] } }, 
	])
});

addTestGroup("If statements", [], () => {
	const tests = [
		{ 
			code: `
			x = 0
			if true {
				x = 1
			}`,
			expected: 1,
		}, { 
			code: `
			x = 0
			if false {
				x = 1
			}`,
			expected: 0,
		}, { 
			code: `
			x = 0
			if true {
				x = 1
			} else {
				x = 2
			}`,
			expected: 1,
		}, { 
			code: `
			x = 0
			if false {
				x = 1
			} else {
				x = 2
			}`,
			expected: 2,
		}, { 
			code: `
			x = 0
			if true {
				x = 1
			} else if false {
				x = 2
			} else {
				x = 3
			}`,
			expected: 1,
		}, { 
			code: `
			x = 0
			if false {
				x = 1
			} else if true {
				x = 2
			} else {
				x = 3
			}`,
			expected: 2,
		}, { 
			code: `
			x = 0
			if false {
				x = 1
			} else if false {
				x = 2
			} else {
				x = 3
			}`,
			expected: 3,
		},
	]

	for (const test of tests) {
		addTest(test.code, r => {
			const result = pl2.interpretCode(test.code);

			const [x, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, undefined);
			testEqualResult(r, x, pl2.newNumber(test.expected));
		});
	}


	addTest("Base if-else statement", r => {
		const result = pl2.interpretCode(`
			x = 0
			if true {
				x = 1
			} else {
				x = 2
			} 
		`);

		const [x, err] = pl2.evaluateCode("x", result);
		testEqual(r, err, undefined);
		testEqualResult(r, x, pl2.newNumber(1));
	});
});

addTestGroup("For-Loops", [], () => {
	const tests = [
		{
			name: "range ..<",
			code: ` for i in 0..<5 { print(i) } `,
			expected: ["0", "1", "2", "3", "4",],
		}, {
			name: "range ..<=",
			code: ` for i in 0..<=5 { print(i) } `,
			expected: ["0", "1", "2", "3", "4","5"],
		}, {
			name: "range ..>",
			code: ` for i in 5..>0 { print(i) } `,
			expected: ["5", "4", "3", "2", "1", ],
		}, {
			name: "range ..>=",
			code: ` for i in 5..>=0 { print(i) } `,
			expected: ["5", "4", "3", "2", "1", "0",],
		}, {
			name: "iterate list - 1 val",
			code: `l = list{10, 20, 30} for x in l { print(x)}`,
			expected: [ "10", "20", "30", ]
		}, {
			name: "iterate list - 1 val",
			code: `l = list{10, 20, 30} for x, i in l { print(x, i)}`,
			expected: [ "10 0", "20 1", "30 2", ]
		}, {
			name: "iterate map",
			code: `m = map{1=21, 2=32, 3=44} for k, v in m { print(k, v) }`,
			expected: [ "1 21", "2 32", "3 44", ]
		}
	];

	for (const test of tests) {
		addTest(test.name, r => {
			const result = pl2.interpretCode(test.code);
			testEqual(r, result.lastResult.error, undefined);
			testEqualLogs(r, result, test.expected);
		})
	}
});

addTestGroup("More complicated programs", [], () => {
	addTestGroup("Fizz buzz versions", [], () => {
		addTest("Fizz buzz", r => {
			const result = pl2.interpretCode(`
				for i in 1..<=15 {
					if i % 3 == 0 && i % 5 == 0 {
						print(i, "fizzbuzz")
					} else if i % 3 == 0 {
						print(i, "fizz")
					} else if i % 5 == 0 {
						print(i, "buzz")
					}
				}
			`);

			testEqualLogs(r, result, [
				"3 fizz",
				"5 buzz",
				"6 fizz",
				"9 fizz",
				"10 buzz",
				"12 fizz",
				"15 fizzbuzz",
			]);
		});

		addTest("Fizz buzz 2", r => {
			const result = pl2.interpretCode(`
				for i in 1..<=15 {
					message = return {
						if i % 3 == 0 && i % 5 == 0 { return("fizzbuzz") } 
						if i % 3 == 0 { return("fizz") } 
						if i % 5 == 0 { return("buzz") }
						return("")
					}
					if len(message) > 0 {
						print(i, message)
					}
				}
			`);

			testEqual(r, result.lastResult.error, undefined);
			testEqualLogs(r, result, [
				"3 fizz",
				"5 buzz",
				"6 fizz",
				"9 fizz",
				"10 buzz",
				"12 fizz",
				"15 fizzbuzz",
			]);
		});

		addTest("Fizz buzz 3", r => {
			const result = pl2.interpretCode(`
				get_message = fn(i) {
					if i % 3 == 0 && i % 5 == 0 { return("fizzbuzz") }
					if i % 3 == 0 { return("fizz") }
					if i % 5 == 0 { return("buzz") }
					return("")
				}

				for i in 1..<=15 {
					message = get_message(i)
					if len(message) > 0 {
						print(i, message)
					}
				}
			`);

			testEqualLogs(r, result, [
				"3 fizz",
				"5 buzz",
				"6 fizz",
				"9 fizz",
				"10 buzz",
				"12 fizz",
				"15 fizzbuzz",
			]);
		});
	});
});


addTestGroup("Returning", [], () => {
	addTest("Return statement", r => {
		const result = pl2.interpretCode(`
			return_a_value = fn() {
				return(1)
				return(2)
				return(3)
			}
		`)

		const [val, err] = pl2.evaluateCode("return_a_value()", result);
		testEqual(r, err, undefined);
		testEqualResult(r, val, pl2.newNumber(1));
	});

	addTest("Return block", r => {
		const result = pl2.interpretCode(`
			return_a_value = fn() {
				return{
					return(1)
					return(2)
					return(3)
				}
			}
		`)

		const [val, err] = pl2.evaluateCode("return_a_value()", result);
		testEqual(r, err, undefined);
		testEqualResult(r, val, pl2.newNumber(1));
	});

	addTest("Raw return shouldn't work", r => {
		const result = pl2.interpretCode(`
			fn return_a_value() {
				1
				2
				return(3)
			}
		`)

		const [val, err] = pl2.evaluateCode("return_a_value()", result);
		testEqual(r, err, undefined);
		testEqualResult(r, val, pl2.newNumber(3));
	});
});

addTestGroup("Indexing", [], () => {
	addTestGroup("list", [], () => {
		addTest("Single list", r => {
			const result = pl2.interpretCode(`
				x = list{10, 20, 30}
				for i in 0..<len(x) {
					print(x[i])
				}
			`);

			testEqualLogs(r, result, [
				"10",
				"20",
				"30",
			])
		});

		addTest("double-list", r => {
			const result = pl2.interpretCode(`
				x = list{
					list{10, 20, 30},
					list{11, 21, 31},
					list{12, 22, 32},
				}
				for i in 0..<len(x) {
					row = x[i]
					for j in 0..<len(row) {
						print(row[j])
					}
				}
			`);

			testEqualLogs(r, result, [
				"10", "20", "30",
				"11", "21", "31",
				"12", "22", "32",
			])
		});
	});

	addTestGroup("map", [], () => {
		addTest("Create a map", r => {
			const result = pl2.interpretCode(`
				x = map{
					1 = 12,
					2 = 25,
					4 = 12,
				}
				for k, v in x {
					print(k, v)
				}
			`);

			testEqualLogs(r, result, [
				"1 12",
				"2 25",
				"4 12",
			]);
		});

		addTest("Insert into  map", r => {
			const result = pl2.interpretCode(`
				x = map{}
				x[1] = 1
			`);

			testEqual(r, result.lastResult.error, undefined);

			// const [x1, err1] = evaluateCode(`x[1]`, result)
			// testEqual(r, err1, undefined);
			// testEqualResult(r, x1, newNumber(1));

			const [x2, err2] = pl2.evaluateCode(`x[2]`, result)
			testEqual(r, err2, undefined);
			testEqualResult(r, x2, pl2.NOTHING)
		});
	});

	addTestGroup("vec", [], () => {
		addTest("Normal Vector", r => {
			const result = pl2.interpretCode(`
				x = vec{1, 2, 3}				
				print(x)
			`);

			testEqualLogs(r, result, [
				"vec[1, 2, 3]",
			]);
		});

		addTest("Vectors to have copy semantics", r => {
			const result = pl2.interpretCode(`
				v = vec{1, 2, 3}

				v2 = v
				v2[0] = 4; v2[1] = 4; v2[2] = 4
			`);

			const v = result.scopes[0].vars.get("v");
			testAssert(r, !!v);
			testEqualResult(r, v, { type: pl2.Result_Vector, val: [1, 2, 3] });

			const v2 = result.scopes[0].vars.get("v2");
			testAssert(r, !!v2);
			testEqualResult(r, v2, { type: pl2.Result_Vector, val: [4, 4, 4] });
		});
	});

	addTestGroup("mat", [], () => {
		addTest("All values matrix", r => {
			const result = pl2.interpretCode(`
				m = mat<3, 4>{
					1, 4, 7, 0,
					2, 5, 8, 0,
					3, 6, 9, 0,
				}
				print(m)
			`);

			testEqual(r, result.lastResult.error, undefined);
			testEqualLogs(r, result, [
`mat[
    [1, 4, 7, 0],
    [2, 5, 8, 0],
    [3, 6, 9, 0],
]`,
			]);
		});

		addTest("Diagnonal matrix", r => {
			const result = pl2.interpretCode(`
				// Stole this from Odin too. Although It's not quite the same, a true equivelant would be more like m: mat<3, 4> = 1
				m = mat<3, 4>{2} 
				print(m)
			`);

			testEqual(r, result.lastResult.error, undefined);
			testEqualLogs(r, result, [
`mat[
    [2, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 2, 0],
]`,
			]);
		});

		addTestGroup("Get value from a matrix", [], () => {
			const cases: { name: string; case: string; expected?: pl2.Result; err?: boolean; }[] = [
				{ name: "m[0]", case: "m[0]", expected: { type: pl2.Result_Vector, val: [2, 0, 0] } },
				{ name: "m[1]", case: "m[1]", expected: { type: pl2.Result_Vector, val: [0, 2, 0] } },
				{ name: "m[2]", case: "m[2]", expected: { type: pl2.Result_Vector, val: [0, 0, 2] } },
				{ name: "m[3]", case: "m[3]", expected: { type: pl2.Result_Vector, val: [0, 0, 0] } },
				{ name: "m[4]", case: "m[4]", err: true, },

				{ name: "m[0, 0]", case: "m[0, 0]", expected: pl2.newNumber(2) },
				{ name: "m[0, 1]", case: "m[0, 1]", expected: pl2.newNumber(0) },
				{ name: "m[0, 2]", case: "m[0, 2]", expected: pl2.newNumber(0) },
				{ name: "m[0, 3]", case: "m[0, 3]", expected: pl2.newNumber(0) },
				{ name: "m[0, 4]", case: "m[0, 4]", err: true },

				{ name: "m[1, 0]", case: "m[1, 0]", expected: pl2.newNumber(0) },
				{ name: "m[1, 1]", case: "m[1, 1]", expected: pl2.newNumber(2) },
				{ name: "m[1, 2]", case: "m[1, 2]", expected: pl2.newNumber(0) },
				{ name: "m[1, 3]", case: "m[1, 3]", expected: pl2.newNumber(0) },
				{ name: "m[1, 4]", case: "m[1, 4]", err: true },

				{ name: "m[2, 0]", case: "m[2, 0]", expected: pl2.newNumber(0) },
				{ name: "m[2, 1]", case: "m[2, 1]", expected: pl2.newNumber(0) },
				{ name: "m[2, 2]", case: "m[2, 2]", expected: pl2.newNumber(2) },
				{ name: "m[2, 3]", case: "m[2, 3]", expected: pl2.newNumber(0) },
				{ name: "m[2, 4]", case: "m[2, 4]", err: true },

				{ name: "m[3, 0]", case: "m[3, 0]", err: true, },
				{ name: "m[3, 1]", case: "m[3, 1]", err: true, },
				{ name: "m[3, 2]", case: "m[3, 2]", err: true, },
				{ name: "m[3, 3]", case: "m[3, 3]", err: true, },
				{ name: "m[3, 4]", case: "m[3, 4]", err: true, },
			];

			for (const testCase of cases) {
				addTest(testCase.name, r => {
					const result = pl2.interpretCode(`m = mat<3, 4>{2}`);
					testNoErrors(r, result);
					const [r1, r1Err] = pl2.evaluateCode(testCase.case, result);

					if (testCase.err) {
						test(r, !!r1Err);
					} else if (testCase.expected) {
						testEqual(r, r1Err, undefined);
						testEqualResult(r, r1, testCase.expected);
					} else {
						throw new Error("need err or expected");
					}
				});
			}
		});

		addTest("Set value into a matrix", r => {
			const result = pl2.interpretCode(`
				m = mat<3, 4>{1}

				m[1]  = vec{10, 10, 10}
				part1 = m

				m[2]  = vec{20, 20, 20}
				part2 = m

				m[3]  = vec{30, 30, 30}
				part3 = m

				m[4]  = vec{40, 40, 40}
				part4 = m
			`);

			testEqualError(r, result, "Index [4] out-of-bounds (4 cols)");

			const part1 = result.scopes[0].vars.get("part1");
			testAssert(r, part1?.type === pl2.Result_Matrix);
			testEqualResult(r, part1, {
				type: pl2.Result_Matrix,
				val: {
					rows: 3, cols: 4,
					data: [
						1, 10, 0, 0,
						0, 10, 0, 0,
						0, 10, 1, 0,
					]
				}
			})

			const part2 = result.scopes[0].vars.get("part2");
			testAssert(r, part2?.type === pl2.Result_Matrix);
			testEqualResult(r, part2, {
				type: pl2.Result_Matrix,
				val: {
					rows: 3, cols: 4,
					data: [
						1, 10, 20, 0,
						0, 10, 20, 0,
						0, 10, 20, 0,
					]
				}
			})

			const part3 = result.scopes[0].vars.get("part3");
			testAssert(r, part3?.type === pl2.Result_Matrix);
			testEqualResult(r, part3, {
				type: pl2.Result_Matrix,
				val: {
					rows: 3, cols: 4,
					data: [
						1, 10, 20, 30,
						0, 10, 20, 30,
						0, 10, 20, 30,
					]
				}
			})

			testEqual(r, result.lastResult.error?.message, "Index [4] out-of-bounds (4 cols)");
		});

		addTest("Matrix to have copy semantics - mutating m2 should not mutate m", r => {
			const result = pl2.interpretCode(`
				m = mat<3, 4>{1}

				m2 = m
				m2[0, 0] = 2
				m2[1, 1] = 3
				m2[2, 2] = 4
			`);

			const m = result.scopes[0].vars.get("m");
			testAssert(r, !!m);
			testEqualResult(r, m, {
				type: pl2.Result_Matrix,
				val: {
					rows: 3,
					cols: 4,
					data: [
						1, 0, 0, 0,
						0, 1, 0, 0,
						0, 0, 1, 0,
					],
				}
			});

			const m2 = result.scopes[0].vars.get("m2");
			testAssert(r, !!m2);
			testEqualResult(r, m2, {
				type: pl2.Result_Matrix,
				val: {
					rows: 3,
					cols: 4,
					data: [
						2, 0, 0, 0,
						0, 3, 0, 0,
						0, 0, 4, 0,
					],
				}
			});
		})
	});
});

addTestGroup("Control 2low", [], () => {
	addTest("return top level", r => {
		const result = pl2.interpretCode(`
			print(1)
			return nothing
			print(2)
			print(3)
		`);
		testEqualLogs(r, result, ["1"]);
	});

	addTest("return in a function", r => {
		const result = pl2.interpretCode(`
			fn test() {
				print(1)
				return nothing
				print(2)
				print(3)
			}
			test()
		`);
		testEqualLogs(r, result, ["1"]);
	});

	addTest("return in a function should not return outer function", r => {
		const result = pl2.interpretCode(`
			fn test() {
				print(1)
				return nothing
				print(2)
				print(3)
			}
			fn test2() {
				test()
				print(4)
			}
			test2()
		`);
		testEqualLogs(r, result, ["1", "4"]);
	});


	addTest("return in an if-statement", r => {
		const result = pl2.interpretCode(`
			fn test() {
				if true {
					print(1)
					return nothing
					print(2)
					print(3)
				}
				print(5)
			}
			test()
			print(6)
		`);
		testEqualLogs(r, result, ["1", "6"]);
	});

	addTest("return in an if-statement in a for loop", r => {
		const result = pl2.interpretCode(`
			fn test() {
				if true {
					for i in 0..<10 {
						print(1)
						return nothing
						print(2)
						print(3)
					}
					print(5)
				}
				print(5)
			}
			test()
		`);
		testEqualLogs(r, result, ["1"]);
	});

	addTest("return in an if-statement in a for loop in a return block", r => {
		const result = pl2.interpretCode(`
			fn test() {
				if true {
					for i in 0..<10 {
						return {
							print(1)
							return nothing
							print(2)
							print(3)
						}
						print(4)
					}
					print(5)
				}
				print(5)
			}
			test()
		`);
		testEqualLogs(r, result, ["1"]);
	});

	addTest("return in an for loop in a for loop in a return block", r => {
		const result = pl2.interpretCode(`
			fn test() {
				for i in 0..<10 {
					for i in 0..<10 {
						print(1)
						return nothing
						print(2)
						print(3)
					}
					print(4)
				}
				print(5)
			}
			test()
		`);
		testEqualLogs(r, result, ["1"]);
	});

	addTest("return in an if in an if in a return block", r => {
		const result = pl2.interpretCode(`
			fn test() {
				if true {
					if true {
						print(1)
						return nothing
						print(2)
						print(3)
					}
					print(4)
				}
				print(5)
			}
			test()
		`);
		testEqualLogs(r, result, ["1"]);
	});
});
