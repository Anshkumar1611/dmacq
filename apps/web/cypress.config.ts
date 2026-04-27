import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    allowCypressEnv: false,
    baseUrl: "http://127.0.0.1:5173",
    video: false,
    screenshotOnRunFailure: true,
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
  },
});
