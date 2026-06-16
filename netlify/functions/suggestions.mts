import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { suggestions } from "../../db/schema.js";

const BODY_MAX = 600;

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db
      .select()
      .from(suggestions)
      .orderBy(desc(suggestions.createdAt))
      .limit(200);
    return Response.json(rows);
  }

  if (req.method === "POST") {
    let payload: { body?: unknown };
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const body = String(payload.body ?? "").trim().slice(0, BODY_MAX);

    if (!body) {
      return Response.json({ error: "Suggestion text is required" }, { status: 400 });
    }

    const [row] = await db.insert(suggestions).values({ body }).returning();

    return Response.json(row, { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/suggestions",
};
