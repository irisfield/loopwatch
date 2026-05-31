import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const tsconfig = "./tsconfig.build.json";

export default [
  {
    input: "src/harness.ts",
    output: {
      file: "dist/harness.iife.js",
      format: "iife",
      name: "__loopwatchHarness",
      sourcemap: true,
    },
    plugins: [typescript({ tsconfig, declaration: false })],
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.mjs", format: "esm", sourcemap: true },
    external: ["node:fs", "node:url", "@playwright/test", "loopwatch", "loopwatch/assert", "loopwatch/serialization"],
    plugins: [typescript({ tsconfig, declaration: false })],
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.min.mjs", format: "esm", sourcemap: true },
    external: ["node:fs", "node:url", "@playwright/test", "loopwatch", "loopwatch/assert", "loopwatch/serialization"],
    plugins: [
      typescript({ tsconfig, declaration: false }),
      terser({
        format: { comments: false },
        mangle: { properties: { regex: /^_/ } },
        compress: { passes: 2 },
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.d.ts", format: "esm" },
    external: ["node:fs", "node:url", "@playwright/test", "loopwatch", "loopwatch/assert", "loopwatch/serialization"],
    plugins: [dts()],
  },
];
