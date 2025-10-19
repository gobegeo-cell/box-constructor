import React from "react";
import { useAnim } from "../store/useAnim";

export default function LidFab() {
  const lidOpen = useAnim((s) => s.lidOpen);
  const toggle = useAnim((s) => s.toggleLid);

  return (
    <div style={{ position: "absolute", right: 16, bottom: 16 }}>
      <button
        onClick={toggle}
        style={{ padding: "10px 14px", border: "none", borderRadius: 12, background: "#ce5e0c", color: "#fff", fontWeight: 700, cursor: "pointer" }}
      >
        {lidOpen ? "Закрыть крышку" : "Открыть крышку"}
      </button>
    </div>
  );
}
