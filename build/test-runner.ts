// @ts-expect-error trust me bro
import { printResults, runAllTests } from "src/testing/testing";
// @ts-expect-error trust me bro
ALL_TESTS

// TODO: parallelism. 
// It's important we do it _after_ we've bundled all the code, so that
// each worker doesn't end up doing a bunch of bundling at the start.
const results = runAllTests();
printResults(results);
