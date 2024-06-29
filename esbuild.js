const { build, context } = require("esbuild");

//@ts-check
/** @typedef {import('esbuild').BuildOptions} BuildOptions **/

/** @type BuildOptions */
const baseConfig = {
    bundle: true,
    minify: process.env.NODE_ENV === "production",
    sourcemap: process.env.NODE_ENV !== "production",
};

/** @type BuildOptions */
const extensionConfig = {
    ...baseConfig,
    platform: "node",
    mainFields: ["module", "main"],
    format: "cjs",
    entryPoints: ["./src/extension/extension.ts"],
    outfile: "./dist/extension.js",
    external: ["vscode"],
};

/**
 * @param {string} subsystem 
 * @returns {BuildOptions}
 */
function getWebviewConfig(subsystem) {
    return {
        ...baseConfig,
        target: "es2020",
        format: "esm",
        entryPoints: [`./src/webview/${subsystem}/index.tsx`],
        outfile: `./dist/${subsystem}/index.js`
    };
}

/** @type BuildOptions[] */
const configs = [
    extensionConfig,
    getWebviewConfig("testcases"),
    getWebviewConfig("stress-tester"),
];

(async () => {
    const args = process.argv.slice(2);
    try {
        if (args.includes("--watch")) {
            console.log("[watch] build started");
            for (const config of configs) {
                (await context(config)).watch();
            }
            console.log("[watch] build finished, watching for changes...");
        } else {
            for (const config of configs) {
                await build(config);
            }
            console.log("build complete");
        }
    } catch (err) {
        process.stderr.write(err.stderr);
        process.exit(1);
    }
})();