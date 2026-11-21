import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["supabase/**/*.test.ts", "lib/**/*.test.ts"], testTimeout: 30000 } });
