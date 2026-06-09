import { deepEquals } from "./deep-equals";

export type TestResult = {
	name:   string;
	fails:  string[] | undefined;

	// Need some way to verify that something happened at all.
	// But this should be the fast path, so we're not literally logging a bunch of strings for passes.
	checks: number; 
}

export type TestContext = {
	tests: TestResult[];
}

export function newTestingContext(): TestContext {
	return {
		tests: [],
	}
}

export function newTestResult(t: TestContext, name: string): TestResult {
	const result: TestResult = {
		name:          name,
		fails:      undefined,
		checks:        0,
	};
	t.tests.push(result);
	return result;
}

export function test(r: TestResult, outcome: boolean, message = "no message"): boolean {
	r.checks += 1;
	if (!outcome) {
		if (!message) message = "check " + r.checks;
		testFailure(r, "Test failed - " + message);
	}
	return outcome;
}

export function testAssert(r: TestResult, outcome: boolean, message: string = ""): asserts outcome {
	r.checks += 1;
	if (!outcome) {
		if (!message) message = "check " + r.checks;
		throw new Error("Test assertion failed - " + message);
	}
}

export function testEqual(r: TestResult, a: unknown, b: unknown) {
	if (!test(r, a === b)) {
		testFailure(r, `    got: ${JSON.stringify(a)}, wanted: ${JSON.stringify(b)}`);
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
	if (!r.fails) r.fails = [];
	r.fails.push(message);
}

export type TestFn = { name: string; group: string; fn: ((r: TestResult) => void) };

const tests: TestFn[] = [];
const groups: string[] = [];
let currentGroup = "";

export function addTest(
	name: string,
	fn: ((r: TestResult) => void)
) {
	if (groups.length === 0) {
		throw new Error("All tests should be grouped under a group");
	}
	tests.push({name, fn, group: currentGroup});
}

// _coveredSymbols allows us to quickly navigate to what we're trying to cover with a particular test.
// It's more useful when the functionality you're covering is not being provided by the functions you call in the test itself.
// Rather than typing the name via a string, inserting the symbol allows the LSP to automatically keep names in sync,
// and notify us when those things get removed from the codebase.
export function addTestGroup(
	name: string,
	_tryingToCover: unknown[],
	registerFn: () => void
) {
	if (_tryingToCover.length === 0) {
		throw new Error("Your test should cover something");
	}

	groups.push(name);
	currentGroup = groups.join(" :: ");
	try {
		registerFn();
	} finally {
		groups.pop();
		currentGroup = groups.join(" :: ");
	}
}

export function runAllTests(): TestContext {
	const t = newTestingContext();
	for (const fn of tests) {
		const r = newTestResult(t, fn.group + " :: " + fn.name);
		try {
			fn.fn(r);
		} catch(e) {
			testFailure(r, "Runtime error: " + e);
		}
	}
	return t;
}
