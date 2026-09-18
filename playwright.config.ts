import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  /*
   * Dois servidores: o jogo (build estático) e a API de contas, com banco e caixa de e-mail só dos
   * testes. É o que deixa a sonda de conta exercitar cadastro, confirmação por e-mail e login contra
   * o servidor DE VERDADE, em vez de um dublê.
   */
  webServer: [
    {
      command: "npm run preview -- --host 127.0.0.1",
      port: 4173,
      reuseExistingServer: true,
    },
    {
      command: "node --experimental-strip-types server/index.ts",
      port: 4001,
      reuseExistingServer: true,
      env: {
        PORT: "4001",
        GR_DB: "data/e2e.sqlite",
        GR_MAIL_DIR: "data/e2e-mail",
        APP_URL: "http://127.0.0.1:4001",
        GAME_URL: "http://127.0.0.1:4173",
        GR_STATIC: "data/sem-jogo-aqui",
      },
    },
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "mobile-landscape",
      use: { ...devices["iPhone 13 landscape"], browserName: "chromium" },
    },
  ],
});
