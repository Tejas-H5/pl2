import { runAllTests, TestGroup, TestResult } from "src/testing/testing";
// @ts-expect-error trust me bro
ALL_TESTS

// TODO: parallelism. 
// It's important we do it _after_ we've bundled all the code, so that
// each worker doesn't end up doing a bunch of bundling at the start.
const results = runAllTests();

function getDisplayableName(name: string): string {
	return name.replace(/\s+/g, " ");
}

function printTestResult(test: TestResult, depth: number) {
	if (test.fails) {
		console.log("  ".repeat(depth + 1), "FAIL", getDisplayableName(test.name));
		for (const fail of test.fails) {
			console.log("  ".repeat(depth + 2), fail);
		}
	} else {
		console.log("  ".repeat(depth + 1), "PASS", getDisplayableName(test.name));
	}
}

const MODE_ALL       = 0;
const MODE_FAILING   = 1;
const MODE_DEBUGGING = 2;

function printResults(g: TestGroup, hasFailures: boolean, depth: number, mode: number) {
	if (hasFailures || depth > 0) {
		if (mode === MODE_FAILING && g._fails === 0) {
			return;
		}

		if (mode === MODE_DEBUGGING && g._debugging === 0) {
			return;
		}
	}

	if (g._fails === 0) {
		console.log("  ".repeat(depth), "PASS (" + g._checks + ", " + Math.floor(g._time) + "ms)", getDisplayableName(g.name));
	} else {
		console.log("  ".repeat(depth), "FAIL (" + g._fails + ", " +  Math.floor(g._time) + "ms)", getDisplayableName(g.name));
	}

	if (g.subgroups) {
		for (const sg of g.subgroups) {
			printResults(sg, hasFailures, depth + 1, mode);
		}
	} else if (g.tests) {
		if (mode === MODE_DEBUGGING && g._debugging > 0) {
			for (const test of g.tests) {
				if (test.isDebugging) {
					printTestResult(test, depth);
				}
			}
		} 
		if (mode === MODE_FAILING && g._fails > 0) {
			for (const test of g.tests) {
				if (test.fails) {
					printTestResult(test, depth);
				}
			}
		}
	}
}

let mode = MODE_FAILING;
for (const g of results.groups) {
	if (g._debugging > 0) {
		mode = MODE_DEBUGGING;
		break;
	}
}

if (mode === MODE_DEBUGGING) {
	console.log("Tests under debug");
}

let hasFailures = false;
for (const g of results.groups) {
	if (g._fails) {
		hasFailures = true;
		break;
	}
}

for (const g of results.groups) {
	printResults(g, hasFailures, 0, mode);
}

