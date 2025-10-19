// src/components/AnimationToggle.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useBoxStore } from "../store/useBoxStore";

// Попытка найти булево "открыто" в сторе по разным ключам
function selectOpen(s: any): boolean {
  return !!(
    s.open ??
    s.isOpen ??
    s.lidOpen ??
    s.boxOpen ??
    s.opened ??
    s.isOpened
  );
}

// Попытка найти toggle-функцию с любым названием
function getToggleFn(): (() => void) | undefined {
  const st: any = useBoxStore.getState();
  return (
    st.toggleOpen ??
    st.toggleLid ??
    st.toggleBox ??
    st.toggle ??
    st.onToggle ??
    st.setOpen && ((): void => st.setOpen(!selectOpen(st))) // костыль
  );
}

// Попытка найти setter с разными именами
function getSetOpenFn(): ((v: boolean) => void) | undefined {
  const st: any = useBoxStore.getState();
  return (
    st.setOpen ??
    st.setLidOpen ??
    st.setBoxOpen ??
    st.setOpened ??
    st.openSet ??
    undefined
  );
}

type Props = { fixedInCorner?: boolean; compact?: boolean };

export default function AnimationToggle({ fixedInCorner = true, compact = true }: Props) {
  const openFromStore = useBoxStore(selectOpen);
  const [openVis, setOpenVis] = useState<boolean>(openFromStore);

  const toggle = getToggleFn();
  const setOpen = getSetOpenFn();

  // синхронизация со стором
  useEffect(() => { setOpenVis(openFromStore); }, [openFromStore]);

  // слушаем события от 3D-модели (если шлёшь)
  useEffect(() => {
    const onOpened = () => { setOpen?.(true); setOpenVis(true); };
    const onClosed = () => { setOpen?.(false); setOpenVis(false); };
    window.addEventListener("box:opened", onOpened as EventListener);
    window.addEventListener("box:closed", onClosed as EventListener);
    return () => {
      window.removeEventListener("box:opened", onOpened as EventListener);
      window.removeEventListener("box:closed", onClosed as EventListener);
    };
  }, [setOpen]);

  const onClick = () => {
    if (toggle) toggle();
    else if (setOpen) setOpen(!openVis);
    else setOpenVis(v => !v); // фоллбэк на всякий случай
  };

  const text = openVis ? "Закрыть коробку" : "Открыть коробку";

  const wrapStyle: React.CSSProperties = fixedInCorner
    ? { position: "absolute", right: 12, bottom: 12, zIndex: 20 }
    : {};

  const btnStyle: React.CSSProperties = {
    padding: compact ? "8px 12px" : "10px 16px",
    borderRadius: 12,
    border: "1px solid #e3e3e3",
    background: "#ffffff",
    color: "#222",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,.06)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={wrapStyle}>
      <button type="button" onClick={onClick} style={btnStyle} aria-pressed={openVis}>
        {text}
      </button>
    </div>
  );
}
