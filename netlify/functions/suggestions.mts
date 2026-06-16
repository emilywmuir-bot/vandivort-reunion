import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";

const BODY_MAX = 600;

type SuggestionRow = {
  id: number;
  body: string;
  created_at: string | Date;
};

function serializeSuggestion(row: SuggestionRow) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db.sql<SuggestionRow[]>`
      SELECT id, body, created_at
      FROM suggestions
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return Response.json(rows.map(serializeSuggestion));
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

    const [row] = await db.sql<SuggestionRow[]>`
      INSERT INTO suggestions (body)
      VALUES (${body})
      RETURNING id, body, created_at
    `;

    return Response.json(serializeSuggestion(row), { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/suggestions",
};
