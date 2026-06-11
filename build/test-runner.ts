// @ts-expect-error trust me bro
import "sideeffect";
// @ts-expect-error trust me bro
import { runAllTests } from "./src/testing/testing";

const results = runAllTests();

for (const res of results.tests) {
	if (!res.fails) {
		console.log("PASS(" + res.checks + ")", res.name)
	} else {
		console.log("FAIL(" + res.checks + ")", res.fails.join("\n"))
	}
}
