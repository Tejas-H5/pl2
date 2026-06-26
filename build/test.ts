import * as esbuild from 'esbuild'
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'url';

const start = performance.now();

// An attempt at a custom testing harness.
// Usually, I'd just run all my tests via a HTML page, so that I can step through
// them with the browser's dev-tools. But I'm trying to move away from relying
// as heavily on the debugger. I suspect that the debugger may actually be slowing
// me down, and not actually be as useful as I had once imagined. 
// It's really handy in environments where I _can_ reach for them, but
// there may be other debugging methods that are simpler that I'm missing out on,
// which would take heavy advantage of the speed of recompilation.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, "../");
const SRC_DIR  = path.join(BASE_DIR, "src");

const config = process.argv[2];

// TODO: filter which test cases we run as needed.
// const filter = process.argv[3];

const testRunnerTemplate = await fs.readFile(path.join(BASE_DIR, "build", "test-runner.ts"), { encoding: "utf-8" });

let entrypoints: string[] = [];
for await (const file of fs.glob("**/*.test.ts", {
	cwd: SRC_DIR,
	exclude: filename => (filename === ".git" || filename === "node_modules")
})) {
	entrypoints.push(file);
}

function runTests(bundledJavaScript: string) {
	new Function(`${bundledJavaScript}`)();
}

function filePathToImportPath(filepath: string): string {
	return filepath.split(path.sep).join("/");
}

const options: esbuild.BuildOptions = {
	bundle: true,
	minify: false,
	write: false,
	stdin: {
		// Can't believe this works!
		// No reason why I can't put all the tests into a HTML file or something like that.
		contents: testRunnerTemplate.replace(/ALL_TESTS/g, entrypoints.map(e => {
			const importPath = filePathToImportPath(e);
			return `import "${importPath}";`
		}).join("\n")),
		resolveDir: BASE_DIR,
		loader: "ts",
	},
	plugins: [{
		name: "Run tests",
		setup(build) {
			build.onEnd((result) => {
				if (!result.outputFiles) {
					return;
				}

				const t0 = performance.now();
				console.clear();

				runTests(result.outputFiles[0].text);

				console.log("Reran all tests in " + Math.floor(performance.now() - t0) + "ms");
			});
		},
	}],
}

if (config === "watch") {
	const ctx = await esbuild.context(options);
	await ctx.watch();
} else {
	await esbuild.build(options);

	console.log("Completed in " + Math.floor(performance.now() - start) + "ms (excluding loading nodejs and whatnot)");
}
