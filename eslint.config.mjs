import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", ".next-e2e/**", "test-results/**", "playwright-report/**", "node_modules/**", "data/**", "next-env.d.ts"] },
  {
    rules: {
      // Allow intentionally unused destructured names prefixed with "_".
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
];

export default config;
