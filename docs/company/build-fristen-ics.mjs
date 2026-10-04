// Baut aus fristen.json eine iCalendar-Datei mit ganztaegigen Terminen.
// Aufruf: node build-ics.mjs fristen.json out.ics
import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
const deadlines = JSON.parse(readFileSync(inputPath, "utf8"));

const escapeText = (text) =>
  String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const foldLine = (line) => {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks = [];
  let start = 0;
  while (start < bytes.length) {
    const width = start === 0 ? 75 : 74;
    let end = Math.min(start + width, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    chunks.push((start === 0 ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return chunks.join("\r\n");
};

const toCompactDate = (isoDate) => isoDate.replace(/-/g, "");
const nextDay = (isoDate) => {
  const day = new Date(`${isoDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
};

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const buildEvent = (deadline, index) => {
  const uid = `unslop-ug-frist-${deadline.date}-${index}@unslop.codes`;
  const summary = `${deadline.prefix ?? "UG-Frist"}: ${deadline.title}`;
  const description = [deadline.description, deadline.legal ? `Rechtsgrundlage: ${deadline.legal}` : "", deadline.consequence ? `Bei Versaeumnis: ${deadline.consequence}` : ""]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${toCompactDate(deadline.date)}`,
    `DTEND;VALUE=DATE:${toCompactDate(nextDay(deadline.date))}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `CATEGORIES:${escapeText(deadline.category ?? "unslop UG")}`,
    "TRANSP:TRANSPARENT",
  ];
  for (const daysBefore of deadline.reminders ?? [7, 1]) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(summary)}`, `TRIGGER:-P${daysBefore}D`, "END:VALARM");
  }
  lines.push("END:VEVENT");
  return lines;
};

const calendar = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//unslop UG//Fristenkalender//DE",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "X-WR-CALNAME:unslop UG Fristen",
  "X-WR-TIMEZONE:Europe/Berlin",
  ...deadlines.flatMap(buildEvent),
  "END:VCALENDAR",
];

writeFileSync(outputPath, calendar.map(foldLine).join("\r\n") + "\r\n", "utf8");
console.log(`${deadlines.length} Termine -> ${outputPath}`);
