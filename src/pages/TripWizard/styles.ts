import type { CSSProperties } from "react";

export const h2: CSSProperties = {
  font: "600 17px/24px Heming",
  margin: "0 0 4px",
  color: "var(--fg-primary)",
};

export const p: CSSProperties = {
  font: "400 13px/18px Heming",
  color: "var(--fg-muted)",
  margin: "0 0 14px",
};

export const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px 20px",
};

export const grid1: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "14px",
};

export const itemCardTitle: CSSProperties = {
  font: "600 13px/18px Heming",
  color: "var(--fg-primary)",
};

export const removeBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--danger-fg)",
  cursor: "pointer",
  font: "500 13px/18px Heming",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

export function itemCard(isMobile: boolean): CSSProperties {
  return {
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    padding: isMobile ? 14 : 18,
    marginTop: 12,
    background: "var(--bg-app)",
  };
}

export const cardHeaderRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};
