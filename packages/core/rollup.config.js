import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const tsconfig = "./tsconfig.build.json";

const subpaths = ["measure-lag", "long-tasks", "loop-monitor", "compare-reports"];

const subpathBuilds = subpaths.flatMap((name) => [
  {
    input: `src/${name}.ts`,
    output: { file: `dist/${name}.mjs`, format: "esm", sourcemap: true },
    plugins: [typescript({ tsconfig, declaration: false })],
  },
  {
    input: `src/${name}.ts`,
    output: { file: `dist/${name}.d.ts`, format: "esm" },
    plugins: [dts()],
  },
]);

export default [
  // ESM — unminified root bundle
  {
    input: "src/index.ts",
    output: { file: "dist/index.mjs", format: "esm", sourcemap: true },
    plugins: [typescript({ tsconfig, declaration: false })],
  },
  // ESM — minified root bundle for CDN usage
  {
    input: "src/index.ts",
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
  // Type declarations — root bundle
  {
    input: "src/index.ts",
    output: { file: "dist/index.d.ts", format: "esm" },
    plugins: [dts()],
  },
  // Subpath ESM + type declarations
  ...subpathBuilds,
];
