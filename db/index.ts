import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema.js";

// The connection is configured automatically by the Netlify Database adapter.
export const db = drizzle({ schema });