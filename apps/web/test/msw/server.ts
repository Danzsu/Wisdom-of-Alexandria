/**
 * Node MSW server for the Vitest (jsdom) environment. Wired into
 * `vitest.setup.ts` (listen / resetHandlers / close).
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
