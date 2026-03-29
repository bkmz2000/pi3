import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useEditor } from "./state/IdeState";
import { MdClose, MdAdd } from "react-icons/md";

export function FileTab({ name }: { name: string }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentFile = useEditor((s) => s.currentFile);
  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const project = useEditor((s) => s.project);
  const changeFile = useEditor((s) => s.changeFile);
  const deleteFile = useEditor((s) => s.deleteFile);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const isCurrent = currentFile === name;
  const isDirty = dirtyFiles.has(name);

  const base =
    "flex-none inline-flex items-center rounded-t-md px-3 whitespace-nowrap select-none transition-colors";
  const active = "bg-white text-cyan-900 h-10";
  const inactive = "bg-gray-400 text-gray-900 hover:bg-gray-300 h-8";

  const commitRename = () => {
    const trimmed = draft.trim();

    if (!trimmed || trimmed === name) {
      setEditing(false);
      setDraft(name);
      return;
    }

    const content = project.files[name];
    deleteFile(name);

    const target = project.files[trimmed] ? trimmed + "_new" : trimmed;

    changeFile(target, content);

    changeCurrentFile(target);
    setEditing(false);
  };

  const cancelRename = () => {
    setEditing(false);
    setDraft(name);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  if (editing) {
    return (
      <div className={`${base} ${active}`}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitRename}
          className="bg-transparent outline-none h-6 leading-6 text-sm"
          aria-label={t('fileBar.renameFile')}
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${base} ${isCurrent ? active : inactive} group pr-1`}
      onClick={() => changeCurrentFile(name)}
      onDoubleClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      title={name}
    >
      <div className="flex items-center gap-1">
        <span>{name}</span>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
        )}
      </div>
      <span
        role="button"
        aria-label={t('fileBar.closeFile', { filename: name })}
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(t('fileBar.deleteConfirm', { filename: name }))) {
            deleteFile(name);
          }
        }}
        className={`
      ml-2 rounded flex items-center justify-center w-4 h-4 text-xs leading-none
      hover:bg-gray-300 hover:text-black
      ${isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
    `}
      >
        <MdClose size={14} />
      </span>
    </button>
  );
}

function NewFileTab() {
  const { t } = useTranslation();
  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const project = useEditor((s) => s.project);
  const changeFile = useEditor((s) => s.changeFile);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const base =
    "flex-none inline-flex items-center rounded-t-md px-3 whitespace-nowrap select-none transition-colors";
  const inactive = "bg-gray-400 text-gray-900 hover:bg-gray-300 h-8";
  const active = "bg-white text-cyan-900 h-10";

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      setName("");
      return;
    }

    const final = project.files[trimmed] ? `${trimmed}_new` : trimmed;

    changeFile(final, "");
    changeCurrentFile(final);

    setEditing(false);
    setName("");
  }

  if (!editing) {
    return (
      <button
        className={`${base} ${inactive} group`}
        onClick={() => setEditing(true)}
        title={t('fileBar.newFileTooltip')}
      >
        <MdAdd size={18} className="opacity-90 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className={`${base} ${active}`}>
      <input
        autoFocus
        value={name}
        placeholder={t('fileBar.untitled')}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setName("");
          }
        }}
        className="bg-transparent outline-none h-6 text-sm"
      />
    </div>
  );
}

export default function FileBar() {
  const project = useEditor((s) => s.project);

  return (
    <>
      <div className="h-12 bg-cyan-700 flex flex-row items-end gap-1 px-2">
        {Object.keys(project.files).map((name) => (
          <FileTab key={name} name={name} />
        ))}

        <NewFileTab />
      </div>
    </>
  );
}
