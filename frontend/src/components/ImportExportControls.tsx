// src/components/ImportExportControls.tsx
import React, { useRef } from 'react';
import { useBoxStore } from '../store/useBoxStore';

export default function ImportExportControls() {
  const exportJSON = useBoxStore((s) => s.exportJSON);
  const importJSON = useBoxStore((s) => s.importJSON);
  const reset = useBoxStore((s) => s.reset);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    try {
      const data = exportJSON();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `box-config-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Не удалось экспортировать JSON');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = reader.result as string;
        importJSON(json);
        alert('Конфигурация успешно загружена');
      } catch (err) {
        console.error(err);
        alert('Ошибка при импорте JSON');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''; // сброс input
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="pc-controls">
      <h3>📥 Импорт / Экспорт</h3>
      <button onClick={handleExport}>💾 Экспорт JSON</button>
      <button onClick={handleImportClick}>📂 Импорт JSON</button>
      <button onClick={reset}>🔄 Сбросить</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
    </div>
  );
}
