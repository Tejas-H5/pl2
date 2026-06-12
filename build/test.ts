import * as esbuild from 'esbuild'
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.join(__dirname, "../");

const testRunnerTemplate = await fs.readFile(path.join(BASE_DIR, "build", "test-runner.ts"), { encoding: "utf-8" });

for await (const file of fs.glob("**/*.test.ts", { cwd: BASE_DIR })) {
	void processTestFile(file);
}

async function processTestFile(filepath: string) {
	await esbuild.build({
		entryPoints: [filepath],
		outdir: "idk",
		bundle: true,
		minify: false,
		write: false,
		stdin: {
			// Can't believe this works!
			// No reason why I can't put all the tests into a HTML file or something like that.
			contents: testRunnerTemplate.replace(/\{\{ModuleName\}\}/g, filepath.split(path.sep).join("/")),
			resolveDir: BASE_DIR,
			loader: "ts",
		},
		plugins: [{
			name: "Run test " + filepath,
			setup(build) {
				build.onEnd((result) => {
					if (!result.outputFiles) return;

					for (const r of result.outputFiles) {
						runTests(r.text);
					}
				});
			},
		}],
	});
}

function runTests(bundledJavaScript: string) {
	new Function(`${bundledJavaScript}`)();
}
