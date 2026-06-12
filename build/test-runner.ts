// @ts-expect-error trust me bro
import "{{ModuleName}}";
import { runAllTests, TestGroup } from "src/testing/testing";

const name = "{{ModuleName}}";

const results = runAllTests(name);

function printResults(g: TestGroup, depth: number, hidePasses: boolean) {
	if (g._fails === 0) {
		if (!hidePasses) {
			console.log("  ".repeat(depth), "PASS (" + g._checks + ")", g.name);
		}
		return;
	} else {
		console.log("  ".repeat(depth), "FAIL (" + g._fails + ")", g.name);
	}

	if (g.subgroups) {
		for (const sg of g.subgroups) {
			printResults(sg, depth + 1, g._fails > 0);
		}
	} else if (g.tests) {
		for (const test of g.tests) {
			console.log("  ".repeat(depth + 1), test.name, test.checks);
			if (!test.fails) {
				continue;
			} else {
				console.log("  ".repeat(depth + 1), test.name);
				for (const fail of test.fails) {
					console.log("  ".repeat(depth + 2), fail);
				}
			}
		}
	}
}

for (const g of results.groups) {
	printResults(g, 0, false);
}
