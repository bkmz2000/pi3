import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IoCopyOutline, IoTrashOutline } from "react-icons/io5";
import { useRunner } from "../runner/RunnerProvider";

export default function ConsolePanel() {
  const { t } = useTranslation();
  const { output, inputPrompt, respondToInput, clear } = useRunner();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output, inputPrompt]);

  useEffect(() => {
    if (inputPrompt !== null) inputRef.current?.focus();
  }, [inputPrompt]);

  const submit = () => {
    if (inputPrompt === null) return;
    respondToInput(inputValue);
    setInputValue("");
  };

  const handleCopyConsole = () => {
    const text = output.map((l) => l.text).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-cyan-900 border-l border-cyan-700 w-5/12 min-w-0 flex flex-col">
      <div className="flex items-center justify-end gap-1 p-2 border-b border-cyan-700">
        <button
          onClick={handleCopyConsole}
          aria-label={t('app.copyConsole')}
          className="p-1.5 rounded hover:bg-cyan-800 text-cyan-300 hover:text-white transition-colors"
          title={t('app.copyConsole')}
        >
          <IoCopyOutline size={16} />
        </button>
        <button
          onClick={clear}
          aria-label={t('app.clearConsole')}
          className="p-1.5 rounded hover:bg-cyan-800 text-cyan-300 hover:text-white transition-colors"
          title={t('app.clearConsole')}
        >
          <IoTrashOutline size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-1.5">
        {output.map((line, i) =>
          line.kind === "stdout" ? (
            <div
              key={i}
              className="text-green-400 whitespace-pre-wrap leading-relaxed font-mono text-sm px-1 py-0.5 rounded hover:bg-cyan-800/50 transition-colors"
            >
              {line.text}
            </div>
          ) : (
            <div
              key={i}
              className="text-red-400 whitespace-pre-wrap leading-relaxed font-mono text-sm px-1 py-0.5 rounded hover:bg-red-900/20 transition-colors"
            >
              {line.text}
            </div>
          ),
        )}

        {inputPrompt !== null && (
          <div className="flex items-center border border-cyan-600 rounded-lg px-3 py-2.5 mt-3 bg-cyan-800">
            <span className="text-green-400 whitespace-pre font-medium font-mono text-sm">
              {inputPrompt}
            </span>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="flex-1 bg-transparent outline-none caret-green-400 text-white min-w-0 ml-3 font-mono text-sm placeholder:text-cyan-300/50"
              spellCheck={false}
              autoComplete="off"
              placeholder={t('app.inputPlaceholder')}
            />
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
