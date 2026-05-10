import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const input = "src/index.ts";
const tsconfig = "./tsconfig.build.json";

export default [
  // 1. ESM — unminified
  {
    input,
    output: { file: "dist/index.mjs", format: "esm", sourcemap: true },
    plugins: [typescript({ tsconfig, declaration: false })],
  },
  // 2. ESM — minified + obfuscated
  {
    input,
    output: { file: "dist/index.min.mjs", format: "esm", sourcemap: true },
    plugins: [
      typescript({ tsconfig, declaration: false }),
      terser({
        format: { comments: false },
        mangle: { properties: { regex: /^_/ } },
        compress: { passes: 2 },
      }),
    ],
  },
  // 3. Type declarations
  {
    input,
    output: { file: "dist/index.d.ts", format: "esm" },
    plugins: [dts()],
  },
];
