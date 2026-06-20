import { test, testFailure, addTest, addTestGroup, setCurrentTestFile, testAssert, testDeepEqual, testEqual, TestResult } from "src/testing/testing";
import * as pl2 from "./interpreter";
import { assertNever } from "./assert";
import { expressionToString } from "./ast";

setCurrentTestFile("src/pl2/interpreter.test.ts", pl2.interpretProgram);

export function testNoErrors(r: TestResult, p: pl2.ProgramIterator) {
	if (!testEqual(r, p.lastResult.error?.message, undefined)) {
		testFailure(r, "'" + expressionToString(p.program.code, p.lastResult.error!.expr) + "'");
	}
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
	if (testEqual(r, result.logs.length, expected.length)) {
		for (let i = 0; i < expected.length; i++) {
			const line = expected[i];
			const got = result.logs[i].text;
			testEqual(r, got, line, "line " + i);
		}
	}
}

addTestGroup("Binary operations", [], () => {
	addTestGroup("Assignment", [], () => {
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

		addTestGroup("Increment assigning", [], () => {
			addTest("Error case", r => {
				const result = pl2.interpretCode("x += 2");
				const [, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, "Variable not found: x");
			});

			const tests = [
				{ sample: "x = 0\n x += 2", expected: pl2.newNumber(2) },
				{ sample: "x = 0\n x -= 2", expected: pl2.newNumber(-2) },
				{ sample: "x = 2\n x *= 2", expected: pl2.newNumber(4) },
				{ sample: "x = 2\n x *= -2", expected: pl2.newNumber(-4) },
				{ sample: "x = 3\n x %= 2", expected: pl2.newNumber(1) },

				{ sample: "x = true\n x &&= true",   expected: pl2.newBoolean(true) },
				{ sample: "x = false\n x &&= true",  expected: pl2.newBoolean(false) },
				{ sample: "x = false\n x ||= true",  expected: pl2.newBoolean(true) },
				{ sample: "x = false\n x ||= false", expected: pl2.newBoolean(false) },
				{ sample: "x = false\n x ^^= true",  expected: pl2.newBoolean(true) },
			];

			for (const test of tests) {
				addTest("Normal cases - " + test.sample, r => {
					const result = pl2.interpretCode(test.sample);
					const [x, err] = pl2.evaluateCode("x", result);
					testEqual(r, err, undefined);
					testEqualResult(r, x, test.expected, test.sample);
				});
			}
		});

		addTestGroup("Comparisons", [], () => {
			const tests = [
				{ name: "test 0", sample: "x = 1 < 2", expected: pl2.newBoolean(true) },
				{ name: "test 1", sample: "x = 2 < 2", expected: pl2.newBoolean(false) },

				{ name: "test 2", sample: "x = 1 <= 2", expected: pl2.newBoolean(true) },
				{ name: "test 3", sample: "x = 2 <= 2", expected: pl2.newBoolean(true) },
				{ name: "test 4", sample: "x = 3 <= 2", expected: pl2.newBoolean(false) },

				{ name: "test 5", sample: "x = 3 > 2", expected: pl2.newBoolean(true) },
				{ name: "test 6", sample: "x = 2 > 2", expected: pl2.newBoolean(false) },

				{ name: "test 7", sample: "x = 3 >= 2", expected: pl2.newBoolean(true) },
				{ name: "test 8", sample: "x = 2 >= 2", expected: pl2.newBoolean(true) },
				{ name: "test 9", sample: "x = 1 >= 2", expected: pl2.newBoolean(false) },

				{ name: "test 10", sample: "x = 15 % 3 == 0", expected: pl2.newBoolean(true) },
				{ name: "test 11", sample: "x = 15 % 5 == 0", expected: pl2.newBoolean(true) },
				{ name: "test 12", sample: "x = 15 % 5 == 0 && 15 % 3 == 0", expected: pl2.newBoolean(true) },
			];

			for (const test of tests) {
				addTest(test.name, r => {
					const result = pl2.interpretCode(test.sample);
					const [x, err] = pl2.evaluateCode("x", result);
					testEqual(r, err, undefined);
					testEqualResult(r, x, test.expected, test.sample);
				});
			}
		});

		addTestGroup("Scope interactions", [], () => {
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
					i = 0
					do_thing = fn() {
						print(i);
					}
					do_thing()
				`);

				testEqualLogs(r,result, []);
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

	addTestGroup("Maths", [], () => {
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


	addTestGroup("Vector elementwise ops", [], () => {
		const tests: { code: string; expected: pl2.Result; debug: boolean; }[] = [
			{ code: `vec{1, 2, 3}   +  vec{3, 2, 1}`, expected: { type: pl2.Result_Vector, val: [4,  4, 4] }, debug: false, },
			{ code: `vec{1, 2, 3}   -  vec{3, 2, 1}`, expected: { type: pl2.Result_Vector, val: [-2, 0, 2] }, debug: false, },
			{ code: `vec{1, 2, 3}   *  vec{3, 2, 1}`, expected: { type: pl2.Result_Vector, val: [3,  4, 3] }, debug: false, },
			{ code: `vec{5, 10, 15} /  vec{5, 5, 5}`, expected: { type: pl2.Result_Vector, val: [1, 2, 3] },  debug: false, },
			{ code: `vec{1,2,3}     == vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [1, 0, 0] },  debug: false, },
			{ code: `vec{1,2,3}     != vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [0, 1, 1] },  debug: false, },
			{ code: `vec{1,2,3}     <  vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [0, 1, 0] },  debug: false, },
			{ code: `vec{1,2,3}     <= vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [1, 1, 0] },  debug: false, },
			{ code: `vec{1,2,3}     >  vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [0, 0, 1] },  debug: false, },
			{ code: `vec{1,2,3}     >= vec{1, 3, 2}`, expected: { type: pl2.Result_Vector, val: [1, 0, 1] },  debug: false, },
		];

		for (const test of tests) {
			addTest(test.code, r => {
				const ctx = pl2.interpretCode("")
				const [result, err] = pl2.evaluateCode(test.code, ctx);
				testEqual(r, err, undefined);
				testEqualResult(r, result, test.expected);
			});
		}
	});

	addTestGroup("Matrix elementwise ops", [], () => {
		const tests: { code: string; expected: pl2.Result }[] = [
			{ code: `mat<1, 3>{1, 2, 3}   +  mat<1, 3>{3, 2, 1}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [4,  4, 4] } } },
			{ code: `mat<1, 3>{1, 2, 3}   -  mat<1, 3>{3, 2, 1}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [-2, 0, 2] } } },
			{ code: `mat<1, 3>{1, 2, 3}   *  mat<1, 3>{3, 2, 1}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [3,  4, 3] } } },
			{ code: `mat<1, 3>{5, 10, 15} /  mat<1, 3>{5, 5, 5}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 2, 3] } } },
			{ code: `mat<1, 3>{1,2,3}     == mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 0, 0] } } },
			{ code: `mat<1, 3>{1,2,3}     != mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [0, 1, 1] } } },
			{ code: `mat<1, 3>{1,2,3}     <  mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [0, 1, 0] } } },
			{ code: `mat<1, 3>{1,2,3}     <= mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 1, 0] } } },
			{ code: `mat<1, 3>{1,2,3}     >  mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [0, 0, 1] } } },
			{ code: `mat<1, 3>{1,2,3}     >= mat<1, 3>{1, 3, 2}`,  expected: { type: pl2.Result_Matrix, val: { rows: 1, cols: 3, data: [1, 0, 1] } } },
		];

		for (const test of tests) {
			addTest(test.code, r => {
				const ctx = pl2.interpretCode("")
				const [result, err] = pl2.evaluateCode(test.code, ctx);
				testEqual(r, err, undefined);
				testEqualResult(r, result, test.expected);
			});
		}
	});

	addTestGroup("Matrix ops ops", [], () => {
		const tests: { prefix: string; code: string; expected: pl2.Result }[] = [
			{ prefix: "", code: `mul(mat<2, 2>{1, 2, 3, 4}, vec{1, 1})`, expected: { type: pl2.Result_Vector, val: [3, 7] } },
			{ prefix: "", code: `transpose(mat<2, 2>{1, 2, 3, 4})`, expected: { type: pl2.Result_Matrix, val: { rows: 2, cols: 2, data: [1, 3, 2, 4] } } },
		];

		for (const test of tests) {
			addTest(test.prefix + test.code, r => {
				const ctx = pl2.interpretCode("")
				const [result, err] = pl2.evaluateCode(test.code, ctx);
				testEqual(r, err, undefined);
				testEqualResult(r, result, test.expected);
			});
		}
	});
})

addTestGroup("User functions", [], () => {
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

addTestGroup("Builtin functions", [], () => {
	addTest("print", r => {
		const result = pl2.interpretCode(`
			print(1 + 1)
		`);

		testEqual(r, result.logs.length, 1);
		testEqual(r, result.logs[0].text, "2");
	});

	const tests = [
		{ name: "max 1", expr: "x = math_max(1, 2)",    expected: pl2.newNumber(2) },
		{ name: "max 2", expr: "x = math_max(2, 1)",    expected: pl2.newNumber(2) },
		{ name: "max 3", expr: "x = math_max(0, 1, 3)", expected: pl2.newNumber(3) },
		{ name: "max 4", expr: "x = math_max()",        expected: pl2.newNumber(-Infinity) },

		{ name: "min 1", expr: "x = math_min(1, 2)",    expected: pl2.newNumber(1) },
		{ name: "min 2", expr: "x = math_min(2, 1)",    expected: pl2.newNumber(1) },
		{ name: "min 3", expr: "x = math_min(0, 1, 3)", expected: pl2.newNumber(0) },
		{ name: "min 4", expr: "x = math_min()",        expected: pl2.newNumber(Infinity) },
		
		{ name: "clamp 1", expr: "x = math_clamp(0.5, 0, 1)", expected: pl2.newNumber(0.5) },
		{ name: "clamp 2", expr: "x = math_clamp(-2, 0, 1)",  expected: pl2.newNumber(0) },
		{ name: "clamp 3", expr: "x = math_clamp(2, 0, 1)",   expected: pl2.newNumber(1) },

		{ name: "sin 1", expr: "x = math_sin(0)",   expected: pl2.newNumber(0) },
		{ name: "cos 1", expr: "x = math_cos(0)",   expected: pl2.newNumber(1) },

		{ name: "len string", expr: `x = len("abc")`,   expected: pl2.newNumber(3) },
	];

	for (const test of tests) {
		addTest("math functions - " + test.name, r => {
			const result = pl2.interpretCode(test.expr);

			const [val, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, undefined, test.name);
			testEqualResult(r, val, test.expected, test.name);
		});
	}
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

			// const [x1, err1] = pl2.evaluateCode(`x[1]`, result)
			// testEqual(r, err1, undefined);
			// testEqualResult(r, x1, pl2.newNumber(1));

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
	});
});

addTestGroup("Control flow", [], () => {
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
