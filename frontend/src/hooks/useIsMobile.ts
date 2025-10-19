// src/hooks/useIsMobile.ts
import { useEffect, useState } from "react";

/**
 * Хук для определения мобильной ширины экрана.
 * @param threshold - ширина в пикселях, ниже которой считается "мобильный" режим (по умолчанию 900)
 * @returns true, если окно <= threshold
 */
export function useIsMobile(threshold = 900): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= threshold;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setIsMobile(window.innerWidth <= threshold);
      });
    };

    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [threshold]);

  return isMobile;
}

// ✅ Экспорт по умолчанию, чтобы можно было импортировать без фигурных скобок
export default useIsMobile;
