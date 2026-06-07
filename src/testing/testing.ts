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

export function test(r: TestResult, outcome: boolean): boolean {
	r.checks += 1;
	if (!outcome) testFailure(r, "Test failed");
	return outcome;
}

export function testAssert(r: TestResult, outcome: boolean, message: string): asserts outcome {
	r.checks += 1;
	if (!outcome) {
		throw new Error("Assertion failed - " + message);
	}
}

export function testEqual(r: TestResult, a: unknown, b: unknown) {
	if (!test(r, a === b)) {
		testFailure(r, `    got: ${a}, wanted: ${b}`);
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

export function addTest(name: string, fn: ((r: TestResult) => void)) {
	tests.push({name, fn, group: currentGroup});
}

export function addTestGroup(name: string, registerFn: () => void) {
	groups.push(name);
	currentGroup = groups.join(" -> ");
	try {
		registerFn();
	} finally {
		groups.pop();
		currentGroup = groups.join(" -> ");
	}
}

export function runAllTests(): TestContext {
	const t = newTestingContext();
	for (const fn of tests) {
		const r = newTestResult(t, currentGroup + fn.name);
		try {
			fn.fn(r);
		} catch(e) {
			testFailure(r, "Runtime error: " + e);
		}
	}
	return t;
}
