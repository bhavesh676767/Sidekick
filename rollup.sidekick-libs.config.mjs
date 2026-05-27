import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "src/sidekickLocalLibs.js",
  output: {
    file: "public/vendor/sidekick-local-libs.js",
    format: "iife",
    name: "SidekickLibBundle",
    extend: true
  },
  plugins: [
    nodeResolve({ browser: true, preferBuiltins: false }),
    json(),
    commonjs()
  ]
};
