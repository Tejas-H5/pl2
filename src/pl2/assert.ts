export function assert(val: boolean): asserts val {
	if (val === false) {
		throw new Error("Assertion failed")
	}
}
