import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";

const NAME_MAX = 40;
const BODY_MAX = 600;
const ADMIN_CODE_VAR = "MESSAGE_ADMIN_CODE";

type MessageRow = {
  id: number;
  name: string;
  body: string;
  upvotes: number;
  created_at: string | Date;
};

function serializeMessage(row: MessageRow) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    upvotes: row.upvotes,
    createdAt: row.created_at,
  };
}

function getAdminCode() {
  const adminCode = Netlify.env.get(ADMIN_CODE_VAR);
  return adminCode && adminCode.trim() ? adminCode : "";
}

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db.sql<MessageRow[]>`
      SELECT id, name, body, upvotes, created_at
      FROM messages
      ORDER BY upvotes DESC, created_at DESC
      LIMIT 200
    `;
    return Response.json(rows.map(serializeMessage));
  }

  if (req.method === "PATCH") {
    let payload: { id?: unknown; action?: unknown };
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Valid message id is required" }, { status: 400 });
    }

    if (payload.action !== "upvote") {
      return Response.json({ error: "Unsupported message action" }, { status: 400 });
    }

    const [row] = await db.sql<MessageRow[]>`
      UPDATE messages
      SET upvotes = upvotes + 1
      WHERE id = ${id}
      RETURNING id, name, body, upvotes, created_at
    `;

    if (!row) {
      return Response.json({ error: "Message not found" }, { status: 404 });
    }

    return Response.json(serializeMessage(row));
  }

  if (req.method === "POST") {
    let payload: { name?: unknown; body?: unknown };
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const name = String(payload.name ?? "").trim().slice(0, NAME_MAX);
    const body = String(payload.body ?? "").trim().slice(0, BODY_MAX);

    if (!body) {
      return Response.json({ error: "Message text is required" }, { status: 400 });
    }

    const [row] = await db.sql<MessageRow[]>`
      INSERT INTO messages (name, body)
      VALUES (${name || "Anonymous"}, ${body})
      RETURNING id, name, body, upvotes, created_at
    `;

    return Response.json(serializeMessage(row), { status: 201 });
  }

  if (req.method === "DELETE") {
    const adminCode = getAdminCode();
    if (!adminCode) {
      return Response.json({ error: "Admin code is not configured" }, { status: 503 });
    }

    let payload: { id?: unknown; adminCode?: unknown };
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (String(payload.adminCode ?? "") !== adminCode) {
      return Response.json({ error: "Invalid admin code" }, { status: 401 });
    }

    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Valid message id is required" }, { status: 400 });
    }

    const [deleted] = await db.sql<{ id: number }[]>`
      DELETE FROM messages
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return Response.json({ error: "Message not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/messages",
};
