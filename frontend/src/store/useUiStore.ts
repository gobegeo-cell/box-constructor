// src/store/useUiStore.ts
import { create } from "zustand";

type UiState = {
  accessCode: string;
  canSeePrices: boolean;
  checking: boolean;
  status: "idle" | "checking" | "ok" | "error";
  error?: string;

  // проверка кода через бэкенд
  checkAccessCode: (code: string) => Promise<void>;
  resetAccess: () => void;

  // для совместимости со старым кодом
  setCanSeePrices?: (on: boolean) => void;
  setAccessCode?: (code: string) => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  accessCode: "",
  canSeePrices: false,
  checking: false,
  status: "idle",
  error: undefined,

  async checkAccessCode(raw: string) {
    const code = (raw || "").trim().toUpperCase();
    if (!code) return set({ accessCode: "", canSeePrices: false, status: "idle" });

    set({ checking: true, status: "checking", error: undefined });
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/api/access/check?code=${encodeURIComponent(code)}`);
      const data = await res.json();

      const ok = !!data?.canSeePrices;
      set({
        accessCode: code,
        canSeePrices: ok,
        checking: false,
        status: ok ? "ok" : "error",
        error: ok ? undefined : "Неверный код",
      });
    } catch (err) {
      console.error("Ошибка проверки кода:", err);
      set({
        accessCode: code,
        canSeePrices: false,
        checking: false,
        status: "error",
        error: "Ошибка соединения с сервером",
      });
    }
  },

  resetAccess() {
    set({
      accessCode: "",
      canSeePrices: false,
      checking: false,
      status: "idle",
      error: undefined,
    });
  },

  // ===== Совместимость со старым кодом =====
  setCanSeePrices(on: boolean) {
    set({ canSeePrices: !!on });
  },

  setAccessCode(code: string) {
    set({ accessCode: (code || "").trim().toUpperCase() });
  },
}));
