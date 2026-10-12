import tseslint from "typescript-eslint";

const eslintConfig = tseslint.config(
  ...tseslint.configs.recommended,
  { ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts", ".sbf-test-build/**", ".sbf-test-run/**"] },
);

export default eslintConfig;
