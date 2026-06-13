import { deepEquals } from "./deep-equals.ts";

export type TestResult = {
	name:   string;
	fails:  string[] | undefined;

	isDebugging: boolean;

	// Need some way to verify that something happened at all.
	// But this should be the fast path, so we're not literally logging a bunch of strings for passes.
	checks: number; 
	time: number;

	fn: ((r: TestResult) => void);
}

export type TestGroup = {
	name:	   string;

	// Only one of the two will ever be set.
	subgroups: TestGroup[] | undefined;
	tests:     TestResult[] | undefined;

	_fails:  number;
	_checks: number;
	_time:   number;
	_debugging: number;
}

export type TestContext = {
	groups: TestGroup[];
}

export function newTestingContext(): TestContext {
	return {
		groups: [],
	};
}

export function test(r: TestResult, outcome: boolean, message = ""): boolean {
	r.checks += 1;
	if (!outcome) {
		if (!message) {
			message = "check " + r.checks;
		}

		testFailure(r, "Test failed - " + message);
	}
	return outcome;
}

export function testEqual(r: TestResult, a: unknown, b: unknown, message = ""): boolean {
	if (!test(r, a === b, message)) {
		testFailure(r, `    got: ${JSON.stringify(a)}, wanted: ${JSON.stringify(b)}`);
		return false;
	}
	return true;
}

// The main use of testAssert comes from asserting the outcome in typescript,
// so you can use it to narrow type unions.
export function testAssert(r: TestResult, outcome: boolean, message: string = ""): asserts outcome {
	if (!test(r, outcome, message)) {
		throw new Error("Test assertion failed");
	}
}

export function testDeepEqual(r: TestResult, a: unknown, b: unknown) {
	const result = deepEquals(a, b);

	if (!test(r, result.mismatches.length === 0)) {
		const message = [`wanted: ${JSON.stringify(a)} !== expected: ${JSON.stringify(b)}`];
		for (const mismatch of result.mismatches) {
			message.push(`${mismatch.path} - ${mismatch.expected} !== ${mismatch.got}`)
		}
		testFailure(r, message.join("\n"));
	}
}

export function testFailure(r: TestResult, message: string) {
	if (!r.fails) {
		r.fails = [];
	}

	r.fails.push(message);
}

export function addTest(name: string, fn: ((r: TestResult) => void), isDebugging: boolean = false) {
	const g = groups[groups.length - 1];

	if (!g.tests) {
		g.tests = [];
	}

	const test: TestResult = {
		name,
		fails: undefined,
		checks: 0,
		time: 0,
		fn,
		isDebugging,
	};

	g.tests.push(test);
}

function newTestGroup(name: string): TestGroup {
	return {
		name:      name,
		subgroups: undefined,
		tests:     undefined,

		_fails:  0,
		_checks: 0,
		_time:   0,
		_debugging: 0,
	};
}

function pushGroup(name: string) {
	const subgroup = newTestGroup(name);

	if (groups.length > 0) {
		const currentGroup = groups[groups.length - 1];
		if (!currentGroup.subgroups) {
			currentGroup.subgroups = [];
		}
		currentGroup.subgroups.push(subgroup);
	}
	groups.push(subgroup);
	if (groups.length === 1) {
		t.groups.push(subgroup);
	}
}

// _coveredSymbols allows us to quickly navigate to what we're trying to cover with a particular test.
// It's more useful when the functionality you're covering is not being provided by the functions you call in the test itself.
// Rather than typing the name via a string, inserting the symbol allows the LSP to automatically keep names in sync,
// and notify us when those things get removed from the codebase.
// You can just leave it empty most of the time, but sometimes it's useful to make some symbols easier to navigate to.
export function addTestGroup(
	name: string,
	_tryingToCover: unknown[],
	registerFn: () => void
) {
	pushGroup(name);

	try {
		registerFn();
	} catch(e) {
		throw e;
	} finally {
		groups.pop();
	}
}

const t = newTestingContext();
const groups: TestGroup[] = [];

export function setCurrentTestFile(name: string, _coveringSymbols: any = null) {
	groups.length = 0;
	pushGroup(name);
}

export function runAllTests(): TestContext {
	let hasDebugTests = false;
	{
		const recomputePreRunAggregateStats = (g: TestGroup) => {
			if (g.tests) {
				for (const test of g.tests) {
					if (test.isDebugging) {
						hasDebugTests = true;
						g._debugging += 1;
					}
				}
			}

			if (g.subgroups) {
				for (const subgroup of g.subgroups) {
					recomputePreRunAggregateStats(subgroup);
					g._debugging += subgroup._debugging;
				}
			}
		}

		for (const g of t.groups) {
			recomputePreRunAggregateStats(g);
		}
	}

	const result = runAllTestsInternal(t.groups, hasDebugTests);

	{
		const recomputeResultAggregateStats = (g: TestGroup) => {
			if (g.tests) {
				for (const test of g.tests) {
					if (test.fails) {
						g._fails += test.fails.length;
					}
					g._checks += test.checks;
					g._time   += test.time;
				}
			}
			if (g.subgroups) {
				for (const subgroup of g.subgroups) {
					recomputeResultAggregateStats(subgroup);
					g._fails  += subgroup._fails;
					g._checks += subgroup._checks;
					g._time   += subgroup._time;
				}
			}
		}
		for (const g of t.groups) {
			recomputeResultAggregateStats(g);
		}
	}

	return result;
}

function runAllTestsInternal(groups: TestGroup[], debugOnly: boolean) {
	for (const group of groups) {
		if (group.tests) {
			for (const test of group.tests) {
				if (debugOnly && !test.isDebugging) {
					continue;
				}

				const t0 = performance.now();
				try {
					test.fn(test);
				} catch(e) {
					testFailure(test, "Runtime error: " + e);
				}
				test.time = performance.now() - t0;
			}
		}

		if (group.subgroups) {
			runAllTestsInternal(group.subgroups, debugOnly);
		}
	}

	return t;
}
