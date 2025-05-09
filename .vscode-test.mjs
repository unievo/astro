import { defineConfig } from "@vscode/test-cli"
import path from "path"

export default defineConfig({
	files: "{out/**/*.test.js,src/**/*.test.js}",
	mocha: {
		ui: "bdd",
		timeout: 25000, // Maximum time (in ms) that a test can run before failing
	},
	workspaceFolder: "test-workspace",
	version: "stable",
	extensionDevelopmentPath: path.resolve("./"),
	launchArgs: ["--disable-extensions"],
})
