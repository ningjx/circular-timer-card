import path from "path";
import { defineConfig } from "@rspack/cli";

export default defineConfig({
	devtool: false,
	entry: {
		"circular-timer-card": "./src/circular-timer-card.js",
		"circular-timer-card-c": "./src/circular-timer-card-c.js",
	},
	output: {
		clean: true,
		filename: "[name].js",
		path: path.resolve(process.cwd(), "dist"),
	},
});
