import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { messages } from "../../db/schema.js";

const NAME_MAX = 40;
const BODY_MAX = 600;
const ADMIN_CODE_VAR = "MESSAGE_ADMIN_CODE";

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(200);
    return Response.json(rows);
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

    const [row] = await db
      .insert(messages)
      .values({ name: name || "Anonymous", body })
      .returning();

    return Response.json(row, { status: 201 });
  }

  if (req.method === "DELETE") {
    const adminCode = Netlify.env.get(ADMIN_CODE_VAR);
    if (!adminCode) {
      return Response.json({ error: "Message deletion is not configured" }, { status: 503 });
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

    const [deleted] = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning({ id: messages.id });

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