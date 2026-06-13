import { addTest, addTestGroup, setCurrentTestFile, testAssert, testEqual, TestResult } from "src/testing/testing";
import * as pl2 from "./interpreter";

setCurrentTestFile("src/pl2/pl2.test.ts", pl2.interpretProgram);

function testEqualResult(r: TestResult, got: pl2.Result, wanted: pl2.Result) {
	switch(wanted.type) {
		case pl2.Result_Nothing: {
			testAssert(r, got.type === wanted.type);
		} break;
		case pl2.Result_Number: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val);
		} break;
		case pl2.Result_String: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val);
		} break;
		case pl2.Result_Boolean: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val);
		} break;
		case pl2.Result_Function: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val, wanted.val);
		} break;
		case pl2.Result_List: {
			testAssert(r, got.type === wanted.type);
			testEqual(r, got.val.length, wanted.val.length);
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

			addTest("Adding", r => {
				const result = pl2.interpretCodeLines([
					"x = 0",
					"x += 2",
				]);

				const [x, err] = pl2.evaluateCode("x", result);

				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(2));
			});

			addTest("Subtracting", r => {
				const result = pl2.interpretCodeLines([
					"x = 0",
					"x -= 2",
				]);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(-2));
			});

			addTest("Multiplying", r => {
				const result = pl2.interpretCodeLines([
					"x = 2",
					"x *= 2",
				]);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(4));
			});

			addTest("Dividing", r => {
				const result = pl2.interpretCodeLines([
					"x = 2",
					"x /= 2",
				]);

				const [x, err] = pl2.evaluateCode("x", result);
				testEqual(r, err, null);
				testEqualResult(r, x, pl2.newNumber(1));
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
