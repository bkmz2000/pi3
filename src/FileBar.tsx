import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useEditor } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import { useUser } from "./state/useUser";
import { useLiveSession } from "./state/useLiveSession";
import { useTeacherShare } from "./state/useTeacherShare";
import { Icon } from "./components/Icons";
import { AuthSection } from "./components/user";

function FileTab({
  name,
  active,
  dirty,
  theme,
  onSelect,
  onClose,
  onRename,
}: {
  name: string;
  active: boolean;
  dirty: boolean;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
  onSelect: () => void;
  onClose: () => void;
  onRename: (newName: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        style={{
          height: active ? 38 : 32,
          padding: "0 14px",
          background: theme.tabActiveBg,
          borderRadius: theme.radiusTab,
          display: "inline-flex",
          alignItems: "center",
          marginRight: 4,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setEditing(false); setDraft(name); }
          }}
          onBlur={commitRename}
          style={{
            all: "unset",
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            fontSize: 13.5,
            color: theme.tabActiveTxt,
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      onDoubleClick={() => { setDraft(name); setEditing(true); }}
      style={{
        all: "unset",
        cursor: "pointer",
        height: active ? 38 : 32,
        padding: "0 14px",
        background: active
          ? theme.tabActiveBg
          : hover
            ? theme.tabInactiveHover
            : theme.tabInactiveBg,
        color: active ? theme.tabActiveTxt : theme.tabInactiveTxt,
        borderRadius: theme.radiusTab,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginRight: 4,
        fontFamily: theme.fontUI,
        fontWeight: active ? theme.weightUI + 100 : theme.weightUI,
        fontSize: 13.5,
        transition: "background 0.15s",
      }}
      title={name}
    >
      <span>{name}</span>
      {dirty && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 7,
            background: theme.tabDirty,
            boxShadow: `0 0 0 2px ${active ? theme.tabActiveBg : theme.filebarBg}`,
          }}
        />
      )}
      {active && (
        <div
          role="button"
          tabIndex={0}
          aria-label={t('fileBar.closeFile', { filename: name })}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.panelTxtMute,
            marginLeft: 2,
            cursor: "pointer",
          }}
        >
          <Icon name="close" size={12} color="currentColor" />
        </div>
      )}
    </button>
  );
}

/**
 * A peer's live buffer as a tab. Visually distinct from a file tab (eye icon,
 * no dirty dot, no rename) because it is somebody else's code, read-only.
 */
function PeerTabButton({
  label,
  active,
  theme,
  onSelect,
  onClose,
}: {
  label: string;
  active: boolean;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
  onSelect: () => void;
  onClose: () => void;
}) {
  const [hover, setHover] = useState(false);
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      title={t('session.peerTabTitle', { name: label })}
      style={{
        all: "unset",
        cursor: "pointer",
        height: active ? 38 : 32,
        padding: "0 12px",
        background: active ? theme.tabActiveBg : hover ? theme.tabInactiveHover : theme.tabInactiveBg,
        color: active ? theme.tabActiveTxt : theme.tabInactiveTxt,
        borderRadius: theme.radiusTab,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginRight: 4,
        fontFamily: theme.fontUI,
        fontWeight: active ? theme.weightUI + 100 : theme.weightUI,
        fontSize: 13.5,
        transition: "background 0.15s",
      }}
    >
      <Icon name="eye" size={13} color="currentColor" />
      <span>{label}</span>
      <div
        role="button"
        tabIndex={0}
        aria-label={t('session.closePeerTab', { name: label })}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClose(); }
        }}
        style={{
          width: 18, height: 18, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: theme.panelTxtMute, marginLeft: 2, cursor: "pointer",
        }}
      >
        <Icon name="close" size={12} color="currentColor" />
      </div>
    </button>
  );
}

function NewFileTab({ theme }: { theme: ReturnType<typeof useThemeStore.getState>["theme"] }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const { t } = useTranslation();
  const changeFile = useEditor((s) => s.changeFile);
  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const project = useEditor((s) => s.project);

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setEditing(false); return; }
    const final = project.files[trimmed] ? `${trimmed}_new` : trimmed;
    changeFile(final, "");
    changeCurrentFile(final);
    setEditing(false);
    setName("");
  };

  if (editing) {
    return (
      <div
        style={{
          height: 38,
          padding: "0 14px",
          background: theme.tabActiveBg,
          borderRadius: theme.radiusTab,
          display: "inline-flex",
          alignItems: "center",
          marginRight: 4,
        }}
      >
        <input
          autoFocus
          value={name}
          placeholder={t('fileBar.untitled')}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={{
            all: "unset",
            fontFamily: theme.fontUI,
            fontSize: 13.5,
            color: theme.tabActiveTxt,
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setEditing(true)}
      title={t('fileBar.newFileTooltip')}
      style={{
        all: "unset",
        cursor: "pointer",
        height: 32,
        padding: "0 10px",
        background: hover ? theme.tabInactiveHover : theme.tabInactiveBg,
        color: theme.tabInactiveTxt,
        borderRadius: theme.radiusTab,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 2,
        transition: "background 0.15s",
      }}
    >
      <Icon name="plus" size={16} color="currentColor" />
    </button>
  );
}

function ProjectShareActions() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user } = useUser();
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const { data, share, unshare, toggleHelp } = useTeacherShare();
  const [showShareInput, setShowShareInput] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!currentProjectId || !user || user.role !== 'student' || !data) return null;

  const handleShare = async () => {
    if (!teacherEmail.trim()) return;
    setSharing(true); setShareError(null);
    try {
      await share(teacherEmail.trim());
      setTeacherEmail('');
      setShowShareInput(false);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Failed');
    }
    setSharing(false);
  };

  const isPending = data.help_request?.status === 'pending';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
      {data.shared ? (
        <>
          {/* I need help toggle */}
          <button
            type="button"
            onClick={toggleHelp}
            title={isPending ? t('teacher.cancelHelp') : t('teacher.iNeedHelp')}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5,
              fontSize: 12, fontWeight: 600,
              background: isPending ? theme.tabDirty : theme.railActiveBg,
              color: isPending ? '#fff' : theme.panelTxt,
            }}
          >
            {isPending ? `✋ ${t('teacher.helpRequested')}` : `✋ ${t('teacher.iNeedHelp')}`}
          </button>
          {/* Shared badge + unshare */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>{t('teacher.sharedWithTeacher')}</span>
            {data.teachers.map(teacher => (
              <button
                key={teacher.id}
                type="button"
                onClick={() => unshare(teacher.id)}
                title={`${t('teacher.unshare')} ${teacher.name}`}
                style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: theme.panelTxtMute }}
              >
                ✕
              </button>
            ))}
          </div>
        </>
      ) : (
        showShareInput ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              autoFocus
              value={teacherEmail}
              onChange={e => setTeacherEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleShare(); if (e.key === 'Escape') setShowShareInput(false); }}
              placeholder={t('teacher.teacherEmailPlaceholder')}
              style={{
                all: 'unset', width: 140, fontSize: 12,
                padding: '3px 8px', borderRadius: 4,
                border: `1px solid ${shareError ? '#e05' : theme.panelBorder}`,
                background: theme.surface, color: theme.panelTxt,
                fontFamily: theme.fontUI,
              }}
            />
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute }}
            >
              {sharing ? '…' : t('teacher.share')}
            </button>
            <button
              type="button"
              onClick={() => { setShowShareInput(false); setShareError(null); }}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowShareInput(true)}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5,
              fontSize: 12, fontWeight: 500,
              background: theme.railActiveBg, color: theme.panelTxt,
            }}
          >
            {t('teacher.shareWithTeacher')}
          </button>
        )
      )}
    </div>
  );
}

export default function FileBar() {
  const theme = useThemeStore((s) => s.theme);
  const project = useEditor((s) => s.project);
  const currentFile = useEditor((s) => s.currentFile);
  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const deleteFile = useEditor((s) => s.deleteFile);
  const changeFile = useEditor((s) => s.changeFile);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const peerTabs = useLiveSession((s) => s.peerTabs);
  const activePeer = useLiveSession((s) => s.activePeer);
  const focusPeer = useLiveSession((s) => s.focusPeer);
  const closePeer = useLiveSession((s) => s.closePeer);
  const { t } = useTranslation();

  const files = Object.keys(project.files);

  const handleRename = (oldName: string, newName: string) => {
    const content = project.files[oldName];
    deleteFile(oldName);
    const target = project.files[newName] ? newName + "_new" : newName;
    changeFile(target, content);
    if (currentFile === oldName) {
      changeCurrentFile(target);
    }
  };

  return (
    <div
      style={{
        height: 44,
        background: theme.filebarBg,
        display: "flex",
        alignItems: "flex-end",
        padding: "0 12px 0 16px",
        gap: 0,
      }}
    >
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
        {files.map((name) => (
          <FileTab
            key={name}
            name={name}
            active={activePeer === null && name === currentFile}
            dirty={dirtyFiles.has(name)}
            theme={theme}
            onSelect={() => { focusPeer(null); changeCurrentFile(name); }}
            onClose={() => {
              if (window.confirm(t('fileBar.deleteConfirm', { filename: name }))) {
                deleteFile(name);
              }
            }}
            onRename={(newName) => handleRename(name, newName)}
          />
        ))}
        <NewFileTab theme={theme} />
        {peerTabs.map((p) => (
          <PeerTabButton
            key={p.id}
            label={p.label}
            active={activePeer === p.id}
            theme={theme}
            onSelect={() => focusPeer(p.id)}
            onClose={() => closePeer(p.id)}
          />
        ))}
      </div>
      <ProjectShareActions />
      <AuthSection />
    </div>
  );
}
