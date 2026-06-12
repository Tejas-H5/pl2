import { addTest, addTestGroup, setCurrentTestFile, testDeepEqual } from "src/testing/testing";
import { interpretCode, interpretProgram, Result_Number } from "./interpreter";

setCurrentTestFile("src/pl2/pl2.test.ts");

addTestGroup("Pl2", [interpretProgram], () => {
	addTest("Basic", r => {
		const result = interpretCode("x = 1");
		testDeepEqual(r, result.scopes[0].vars.get("x"), { type: Result_Number, val: 1 });
	})
});
