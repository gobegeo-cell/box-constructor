import React from "react";
import AnimationToggle from "./AnimationToggle";

export default function Controls() {
  return (
    <div
      style={{
        padding: 16,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,.08)",
        display: "inline-flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 14, color: "#666" }}>Управление:</span>
      <AnimationToggle />
    </div>
  );
}
