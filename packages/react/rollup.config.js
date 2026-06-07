import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const tsconfig = "./tsconfig.build.json";

export default [
  {
    input: "src/index.ts",
    output: { file: "dist/index.mjs", format: "esm", sourcemap: true },
    external: ["react", "@irisfield/loopwatch"],
    plugins: [typescript({ tsconfig, declaration: false })],
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.d.ts", format: "esm" },
    external: ["react", "@irisfield/loopwatch"],
    plugins: [dts({ tsconfig })],
  },
];
