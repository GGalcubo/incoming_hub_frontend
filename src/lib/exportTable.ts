const BOM = "﻿";

export async function copyTableTsv(headers: string[], rows: string[][]): Promise<void> {
  const tsv = [headers, ...rows].map((r) => r.map(cleanCell).join("\t")).join("\n");
  await navigator.clipboard.writeText(tsv);
}

export function downloadTableXls(headers: string[], rows: string[][], filename: string): void {
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html><head><meta charset="utf-8"></head><body><table>${thead}${tbody}</table></body></html>`;
  const blob = new Blob([BOM + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cleanCell(v: string): string {
  return v.replace(/[\t\n\r]+/g, " ");
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
