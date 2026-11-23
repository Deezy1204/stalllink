// Reads the cell values of .xlsx workbooks (Excel, Google Sheets, LibreOffice,
// WPS) and .csv files, as the app does (LocalinkGo/lib/core/utils/xlsx.dart).
// An .xlsx file is a zip of XML parts: xl/workbook.xml names the sheets,
// xl/_rels/workbook.xml.rels says which part holds each, and text cells
// point into xl/sharedStrings.xml.

import { strFromU8, unzipSync } from "fflate";

export interface SheetTable {
  name: string;
  rows: string[][];
}

export class SpreadsheetError extends Error {}

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
/** Elements by local name, whatever their namespace prefix. */
const all = (n: Document | Element, name: string) => [...n.getElementsByTagNameNS("*", name)];
const text = (e: Element) => all(e, "t").map((t) => t.textContent ?? "").join("");

function column(ref: string) {
  let n = 0;
  for (const ch of ref.toUpperCase()) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export function readXlsx(bytes: Uint8Array): SheetTable[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new SpreadsheetError("This file could not be opened as an Excel workbook (.xlsx).");
  }
  const part = (path: string) => (files[path] ? parse(strFromU8(files[path])) : null);
  const workbook = part("xl/workbook.xml");
  if (!workbook) throw new SpreadsheetError("This file is not an Excel workbook (.xlsx).");

  const targets = new Map<string, string>();
  for (const r of all(part("xl/_rels/workbook.xml.rels") ?? parse("<x/>"), "Relationship")) {
    const t = r.getAttribute("Target") ?? "";
    targets.set(r.getAttribute("Id") ?? "", t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`);
  }
  const shared = all(part("xl/sharedStrings.xml") ?? parse("<x/>"), "si").map(text);

  const sheets: SheetTable[] = [];
  all(workbook, "sheet").forEach((s, i) => {
    const rid = [...s.attributes].find((a) => a.localName === "id")?.value ?? "";
    const doc = part(targets.get(rid) ?? `xl/worksheets/sheet${i + 1}.xml`);
    if (!doc) return;
    const rows: string[][] = [];
    for (const row of all(doc, "row")) {
      const r = Number(row.getAttribute("r")) || rows.length + 1;
      while (rows.length < r - 1) rows.push([]);
      const cells: string[] = [];
      let next = 0;
      for (const c of [...row.children].filter((x) => x.localName === "c")) {
        const ref = c.getAttribute("r");
        const col = ref ? column(ref) : next;
        next = col + 1;
        const v = [...c.children].find((x) => x.localName === "v")?.textContent ?? "";
        const type = c.getAttribute("t");
        const inline = [...c.children].find((x) => x.localName === "is");
        const value = type === "s" ? (shared[Number(v)] ?? "") : type === "inlineStr" ? (inline ? text(inline) : "") : type === "b" ? (v === "1" ? "TRUE" : "FALSE") : type === "e" ? "" : v;
        while (cells.length < col) cells.push("");
        cells[col] = value.trim();
      }
      rows.push(cells);
    }
    sheets.push({ name: s.getAttribute("name") ?? `Sheet${i + 1}`, rows });
  });
  if (!sheets.length) throw new SpreadsheetError("This workbook has no sheets.");
  return sheets;
}

/** Comma- (or semicolon-) separated values, with "quoted, fields". */
export function readCsv(textIn: string): string[][] {
  const textAll = textIn.replace(/^﻿/, "");
  const first = textAll.split("\n")[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < textAll.length; i++) {
    const ch = textAll[i];
    if (quoted) {
      if (ch === '"' && textAll[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && textAll[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

export async function readSpreadsheet(file: File): Promise<SheetTable[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return [{ name: "Products", rows: readCsv(await file.text()) }];
  if (name.endsWith(".xls")) throw new SpreadsheetError("That is an old Excel file (.xls). In Excel choose File → Save As → Excel Workbook (.xlsx), then upload that.");
  return readXlsx(new Uint8Array(await file.arrayBuffer()));
}
