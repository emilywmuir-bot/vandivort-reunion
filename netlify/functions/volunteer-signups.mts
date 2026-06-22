import type { Config } from "@netlify/functions";

const CSV_URL_VAR = "VOLUNTEER_SIGNUPS_CSV_URL";
const MAX_ROWS = 200;

type VolunteerSignup = {
  dateKey: string;
  dateLabel: string;
  time: string;
  description: string;
  task: string;
  name: string;
  detail: string;
};

type ShiftColumn = {
  index: number;
  dateKey: string;
  dateLabel: string;
  kind: "time" | "duty" | "slot";
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function labelFromHeader(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function splitShiftCell(value: string) {
  return value
    .split(/\n|;|(?<=\b[ap]\.?m\.?),\s+(?=[A-Z])/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSlotCell(value: string) {
  return value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSlotValue(value: string) {
  const text = value.trim();
  const timeMatch = text.match(/^((?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:-|to)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)|(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?))(?:\s*[-:,]\s*)?(.*)$/i);
  if (!timeMatch) return { time: "", description: text };
  return {
    time: timeMatch[1].trim(),
    description: (timeMatch[2] || "").trim() || text,
  };
}

function splitTrailingTime(value: string) {
  const text = value.trim();
  const match = text.match(/^(.*?)(?:[\s,;:\-\u2013\u2014]+)(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))$/i);
  if (!match) return { description: text, time: "" };

  return {
    description: match[1].trim(),
    time: match[2].trim(),
  };
}

function shiftColumnFromHeader(rawHeader: string, normalizedHeader: string, index: number): ShiftColumn | null {
  const label = labelFromHeader(rawHeader);
  const dayMatch = normalizedHeader.match(/(?:july|jul)([2-5])/) || normalizedHeader.match(/^([2-5])(?:nd|rd|th)?/);
  const weekdayMatch = normalizedHeader.match(/thursday|friday|saturday|sunday/);
  const day = dayMatch?.[1]
    || (weekdayMatch?.[0] === "thursday" ? "2" : "")
    || (weekdayMatch?.[0] === "friday" ? "3" : "")
    || (weekdayMatch?.[0] === "saturday" ? "4" : "")
    || (weekdayMatch?.[0] === "sunday" ? "5" : "");
  const hasShift = /july\d+shifts?/.test(normalizedHeader) || /shifts?$/.test(normalizedHeader);
  const hasTime = /time|when|hour/.test(normalizedHeader);
  const hasDuty = /duty|description|task|job|activity|role|assignment/.test(normalizedHeader);

  if (!day && !hasShift) return null;

  const dateKey = day ? `2026-07-0${day}` : `column-${index}`;
  const dateLabel = day ? `July ${day}` : label;
  const kind = hasTime ? "time" : hasDuty ? "duty" : "slot";

  return { index, dateKey, dateLabel, kind };
}

function combinedShiftLabel(dateLabel: string, time: string, duty: string) {
  const parts = [time, duty].map((part) => part.trim()).filter(Boolean);
  return [dateLabel, parts.join(" - ")].filter(Boolean).join(": ");
}

function volunteerSignup(dateKey: string, dateLabel: string, time: string, description: string, name: string, detail = "") {
  const parsedDescription = splitTrailingTime(description);
  const resolvedTime = time.trim() || parsedDescription.time;
  const resolvedDescription = parsedDescription.description || description.trim();

  return {
    dateKey,
    dateLabel,
    time: resolvedTime,
    description: resolvedDescription,
    task: combinedShiftLabel(dateLabel, resolvedTime, resolvedDescription),
    name: name.trim(),
    detail: detail.trim(),
  };
}

function serializeRows(csv: string): VolunteerSignup[] {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) return [];

  const rawHeaders = rows[0];
  const headers = rows[0].map(normalizeHeader);
  const taskIndex = findIndex(headers, ["task", "job", "activity", "slot", "volunteeropportunity", "signup", "shift"]);
  const nameIndex = findIndex(headers, ["name", "fullname", "volunteer", "person", "who", "yourname"]);
  const detailIndex = findIndex(headers, [
    "detail",
    "details",
    "notes",
    "comment",
    "comments",
    "time",
    "when",
    "anythingelseweshouldknowaboutyou",
  ]);
  const shiftColumns = headers
    .map((header, index) => shiftColumnFromHeader(rawHeaders[index], header, index))
    .filter((column): column is ShiftColumn => Boolean(column));
  const metadataIndexes = new Set([
    findIndex(headers, ["timestamp"]),
    findIndex(headers, ["email", "emailaddress"]),
    findIndex(headers, ["phone", "phonenumber", "phonenumberfordayofcoordination"]),
    nameIndex,
    detailIndex,
  ].filter((index) => index >= 0));

  const items: VolunteerSignup[] = [];
  rows.slice(1).forEach((row) => {
    const name = nameIndex >= 0 ? row[nameIndex] || "" : "";
    const detail = detailIndex >= 0 ? row[detailIndex] || "" : "";

    if (shiftColumns.length) {
      const columnsByDate = new Map<string, ShiftColumn[]>();
      shiftColumns.forEach((column) => {
        columnsByDate.set(column.dateKey, [...(columnsByDate.get(column.dateKey) || []), column]);
      });

      columnsByDate.forEach((columns) => {
        const timeValues = columns
          .filter((column) => column.kind === "time")
          .flatMap((column) => splitShiftCell(row[column.index] || ""));
        const dutyValues = columns
          .filter((column) => column.kind === "duty")
          .flatMap((column) => splitShiftCell(row[column.index] || ""));
        const slotValues = columns
          .filter((column) => column.kind === "slot")
          .flatMap((column) => splitSlotCell(row[column.index] || ""));
        const combinedCount = Math.max(timeValues.length, dutyValues.length);

        if (combinedCount) {
          for (let index = 0; index < combinedCount; index += 1) {
            items.push(volunteerSignup(
              columns[0].dateKey,
              columns[0].dateLabel,
              timeValues[index] || "",
              dutyValues[index] || "",
              name,
            ));
          }
        }

        slotValues.forEach((shift) => {
          const slot = parseSlotValue(shift);
          items.push(volunteerSignup(columns[0].dateKey, columns[0].dateLabel, slot.time, slot.description, name, detail));
        });
      });
      return;
    }

    const fallbackTask = row.find((cell, index) => !metadataIndexes.has(index) && cell.trim()) || "";
    const task = taskIndex >= 0 ? row[taskIndex] || "" : fallbackTask;
    items.push({
      dateKey: "other",
      dateLabel: "Other volunteer slots",
      time: "",
      description: task.trim(),
      task: task.trim(),
      name: name.trim(),
      detail: detail.trim(),
    });
  });

  const seen = new Set<string>();
  return items
    .filter((item) => item.task || item.name || item.detail)
    .filter((item) => {
      const key = [item.dateKey, item.time, item.description, item.name].map((value) => value.toLowerCase()).join("\u0000");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ROWS);
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const csvUrl = Netlify.env.get(CSV_URL_VAR);
  if (!csvUrl) {
    return Response.json({ error: "Volunteer signups are not configured" }, { status: 503 });
  }

  const csvRes = await fetch(csvUrl, {
    headers: { "Accept": "text/csv,*/*;q=0.8" },
  });

  if (!csvRes.ok) {
    return Response.json({ error: "Could not load volunteer signups" }, { status: 502 });
  }

  const csv = await csvRes.text();
  return Response.json(serializeRows(csv), {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
};

export const config: Config = {
  path: "/api/volunteer-signups",
};
