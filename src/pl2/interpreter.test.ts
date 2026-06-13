import { addTest, addTestGroup, setCurrentTestFile, testAssert, testEqual, TestResult } from "src/testing/testing";
import * as pl2 from "./interpreter";

setCurrentTestFile("src/pl2/interpreter.test.ts", pl2.interpretProgram);

function testEqualResult(r: TestResult, got: pl2.Result, wanted: pl2.Result, message = "") {
	switch(wanted.type) {
		case pl2.Result_Nothing: {
			testAssert(r, got.type === wanted.type);
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
	}
}

addTestGroup("Binary operations", [], () => {
	addTestGroup("Assignment", [], () => {
		addTest("Normal assigning", r => {
			const result = pl2.interpretCode("x = 1");

			const [x, err] = pl2.evaluateCode("x", result);
			testAssert(r, err === null);
			testEqualResult(r, x, { type: pl2.Result_Number, val: 1 });
		});

		addTestGroup("Increment assigning", [], () => {
			addTest("Error case", r => {
				const result = pl2.interpretCode("x += 2");
				const [, err] = pl2.evaluateCode("x", result);
				testEqual(r, err?.reason, "Variable not found: x");
			});

			const tests = [
				{ sample: "x = 0\n x += 2", expected: pl2.newNumber(2) },
				{ sample: "x = 0\n x -= 2", expected: pl2.newNumber(-2) },
				{ sample: "x = 2\n x *= 2", expected: pl2.newNumber(4) },
				{ sample: "x = 2\n x *= -2", expected: pl2.newNumber(-4) },

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
					testEqual(r, err, null);
					testEqualResult(r, x, test.expected, test.sample);
				});
			}
		});

		addTestGroup("Comparisons", [], () => {
			const tests = [
				{ sample: "x = 1 < 2", expected: true },
				{ sample: "x = 2 < 2", expected: false },

				{ sample: "x = 1 <= 2", expected: true },
				{ sample: "x = 2 <= 2", expected: true },
				{ sample: "x = 3 <= 2", expected: false },

				{ sample: "x = 3 > 2", expected: true },
				{ sample: "x = 2 > 2", expected: false },

				{ sample: "x = 3 >= 2", expected: true },
				{ sample: "x = 2 >= 2", expected: true },
				{ sample: "x = 1 >= 2", expected: false },
			];

			for (const test of tests) {
				addTest("Normal cases - " + test.sample, r => {
					const result = pl2.interpretCode(test.sample);
					const [x, err] = pl2.evaluateCode("x", result);
					testEqual(r, err, null);
					testEqualResult(r, x, { type: pl2.Result_Boolean, val: test.expected }, test.sample);
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
				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(2))

				const [y, err2] = pl2.evaluateCode("y", result);
				testEqual(r, err2, null);
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
				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(0));
			});

			addTest("Should be able to mutate variables through return block scopes", r => {
				const result = pl2.interpretCode(`
					x = 0
					y = return{
						x = 1
					}
				`);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(1));
			});

			addTest("Variables shouldn't leak out of their blokcs", r => {
				const result = pl2.interpretCode(`
					if 1<2 {
						x = 0
					}
				`);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err?.reason, "Variable not found: x");
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
			testEqual(r, err, null);
			testEqualResult(r, c, pl2.newNumber(2));
		});

		addTest("Order of ops", r => {
			const result = pl2.interpretCodeLines([
				"x = 2 * 2 + 1",
			]);

			const [c, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, null);
			testEqualResult(r, c, pl2.newNumber(5));
		});

		addTest("Order of ops 2", r => {
			const result = pl2.interpretCodeLines([
				"x = 1 + 2 * 2",
			]);

			const [c, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, null);
			testEqualResult(r, c, pl2.newNumber(5));
		});

		addTest("Order of ops 2", r => {
			const result = pl2.interpretCodeLines([
				"x = (1 + 2) * 2",
			]);

			const [c, err] = pl2.evaluateCode("x", result);
			testEqual(r, err, null);
			testEqualResult(r, c, pl2.newNumber(6));
		});
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
		testEqual(r, err2, null);
		testEqual(r, val.type, pl2.Result_Function);
	});


	addTest("Can call a user-defined function", r => {
		const result = pl2.interpretCode(`
			increment = fn(x) {
				return(x + 1)
			}
		`);

		const [c, err] = pl2.evaluateCode("increment(2)", result);
		testEqual(r, err, null);
		testEqualResult(r, c, pl2.newNumber(3));
	});
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
			testEqual(r, err, null);
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
		testEqual(r, err, null);
		testEqualResult(r, x, pl2.newNumber(1));
	});
});
