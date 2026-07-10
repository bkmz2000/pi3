import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import {
  getGroups, createGroup, getGroup, deleteGroup, inviteToGroup, removeFromGroup,
  updateGroup, regenerateInviteCode,
  ApiHttpError,
  type Group, type GroupDetail,
} from '../../state/api';
import { asyncAction } from '../../state/asyncAction';
import { Icon } from '../Icons';
import { ThemedDialog } from '../ThemedDialog';
import { GroupQueueView } from './GroupQueueView';
import { inputStyle, btnPrimary, btnSecondary } from './styles';
import { userLabel } from '../../utils/userDisplay';

export function GroupsSection() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [queueGroupId, setQueueGroupId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<GroupDetail | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteInputs, setInviteInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setGroups(await getGroups(showArchived)); } catch { /* ignore */ }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [showArchived]);

  async function expand(groupId: string) {
    if (expandedId === groupId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(groupId);
    setExpandedDetail(null);
    try { setExpandedDetail(await getGroup(groupId)); } catch { /* surfaced via asyncAction elsewhere */ }
  }

  async function refreshExpanded() {
    if (!expandedId) return;
    try { setExpandedDetail(await getGroup(expandedId)); } catch { /* ignore */ }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const g = await createGroup(newName.trim());
      setGroups((prev) => [g, ...prev]);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      if (e instanceof ApiHttpError && e.code === 'cap_groups_reached') {
        setError(t('teacher.capGroupsReached', { limit: e.limit ?? 3 }));
      } else {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    }
    setSubmitting(false);
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    const original = groups;
    setPendingDelete(null);
    try {
      await asyncAction(() => deleteGroup(id), {
        errorMessage: () => `Failed to delete group "${name}"`,
        onError: () => setGroups(original),
      });
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (queueGroupId === id) setQueueGroupId(null);
      if (expandedId === id) { setExpandedId(null); setExpandedDetail(null); }
    } catch { /* surfaced by asyncAction */ }
  }

  async function handleInvite(groupId: string) {
    const value = (inviteInputs[groupId] ?? '').trim();
    if (!value) return;
    try {
      await asyncAction(() => inviteToGroup(groupId, value), {
        errorMessage: (err) => {
          if (err instanceof ApiHttpError && err.code === 'cap_members_reached') {
            return t('teacher.capMembersReached', { limit: err.limit ?? 10 });
          }
          return t('teacher.inviteFailed');
        },
      });
      setInviteInputs((prev) => ({ ...prev, [groupId]: '' }));
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g));
      await refreshExpanded();
    } catch { /* ignore */ }
  }

  async function handleRemoveMember(groupId: string, userId: string) {
    try {
      await asyncAction(() => removeFromGroup(groupId, userId), {
        errorMessage: () => t('teacher.removeFailed'),
      });
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g));
      await refreshExpanded();
    } catch { /* ignore */ }
  }

  async function handleRegenerate(groupId: string) {
    try {
      const { invite_code } = await asyncAction(() => regenerateInviteCode(groupId), {
        errorMessage: () => t('teacher.codeRegenFailed'),
      });
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, invite_code } : g));
      if (expandedDetail?.id === groupId) {
        setExpandedDetail({ ...expandedDetail, invite_code });
      }
    } catch { /* ignore */ }
  }

  async function commitRename(groupId: string) {
    const next = renameValue.trim();
    setRenamingId(null);
    if (!next) return;
    const original = groups.find((g) => g.id === groupId)?.name;
    if (!original || next === original) return;
    try {
      const updated = await asyncAction(() => updateGroup(groupId, { name: next }), {
        errorMessage: () => t('teacher.renameFailed'),
      });
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, name: updated.name } : g));
    } catch { /* ignore */ }
  }

  async function handleArchive(groupId: string, archived: boolean) {
    try {
      const updated = await asyncAction(() => updateGroup(groupId, { archived }), {
        errorMessage: () => t('teacher.archiveFailed'),
      });
      if (showArchived) {
        setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, archived_at: updated.archived_at } : g));
      } else {
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
      }
    } catch { /* ignore */ }
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  if (queueGroupId) {
    const group = groups.find((g) => g.id === queueGroupId);
    return <GroupQueueView groupId={queueGroupId} groupName={group?.name ?? ''} onBack={() => setQueueGroupId(null)} />;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 10 }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>{t('teacher.groups')}</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.panelTxtMute, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t('teacher.showArchived')}
        </label>
        <button type="button" onClick={() => setShowCreate(true)} style={btnPrimary(theme)}>
          + {t('teacher.createGroup')}
        </button>
      </div>

      {loading ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('sideMenu.loading')}</div>
      ) : groups.length === 0 ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noGroups')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g) => {
            const isExpanded = expandedId === g.id;
            const isArchived = g.archived_at !== null;
            return (
              <div key={g.id} style={{ border: `1px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden', opacity: isArchived ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent' }}>
                  <button
                    type="button"
                    onClick={() => expand(g.id)}
                    title={isExpanded ? t('teacher.collapse') : t('teacher.expand')}
                    style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.12s' }}
                  >
                    ▶
                  </button>
                  <Icon name="users" size={16} color={theme.panelTxtMute} />
                  {renamingId === g.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(g.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        else if (e.key === 'Escape') setRenamingId(null);
                      }}
                      style={{ ...inputStyle(theme), flex: 1, fontSize: 13, padding: '4px 6px' }}
                    />
                  ) : (
                    <span
                      style={{ flex: 1, fontWeight: 500, fontSize: 13, color: theme.panelTxt, cursor: 'text' }}
                      onDoubleClick={() => { setRenameValue(g.name); setRenamingId(g.id); }}
                      title={t('teacher.doubleClickToRename')}
                    >
                      {g.name}
                      {isArchived && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {t('teacher.archived')}
                        </span>
                      )}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.members', { count: g.member_count })}</span>
                  <button
                    type="button"
                    onClick={() => setQueueGroupId(g.id)}
                    title={t('teacher.openQueue')}
                    style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: 4 }}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(g.id, !isArchived)}
                    title={isArchived ? t('teacher.unarchive') : t('teacher.archive')}
                    style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: 4, fontSize: 11 }}
                  >
                    <span style={{ fontFamily: theme.fontUI, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {isArchived ? t('teacher.unarchive') : t('teacher.archive')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: g.id, name: g.name })}
                    title={t('teacher.deleteGroup')}
                    style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: 4 }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${theme.panelBorder}`, padding: '12px 14px', background: theme.chip }}>
                    {/* Invite code */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('teacher.inviteCode')}
                      </span>
                      <code style={{ fontSize: 14, fontFamily: theme.fontMono, fontWeight: 700, color: theme.panelTxt, letterSpacing: 1.5, padding: '4px 10px', background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 6 }}>
                        {g.invite_code ?? '—'}
                      </code>
                      <button
                        type="button"
                        onClick={() => g.invite_code && copyToClipboard(g.invite_code)}
                        disabled={!g.invite_code}
                        title={t('teacher.copyCode')}
                        style={{ all: 'unset', cursor: 'pointer', color: theme.accent, fontSize: 12, fontWeight: 600 }}
                      >
                        {t('teacher.copy')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(g.id)}
                        title={t('teacher.regenerateCode')}
                        style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, fontSize: 12 }}
                      >
                        {t('teacher.regenerate')}
                      </button>
                    </div>

                    {/* Invite by handle / name */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <input
                        style={{ ...inputStyle(theme), flex: 1, fontSize: 12, padding: '6px 8px' }}
                        placeholder={t('teacher.inviteByHandlePlaceholder')}
                        value={inviteInputs[g.id] ?? ''}
                        onChange={(e) => setInviteInputs((prev) => ({ ...prev, [g.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(g.id); }}
                      />
                      <button type="button" onClick={() => handleInvite(g.id)} style={btnSecondary(theme)}>
                        {t('teacher.invite')}
                      </button>
                    </div>

                    {/* Roster */}
                    {expandedDetail?.id === g.id ? (
                      expandedDetail.members.length === 0 ? (
                        <div style={{ fontSize: 12, color: theme.panelTxtMute, padding: '4px 0' }}>
                          {t('teacher.noMembers')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {expandedDetail.members.map((m) => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: theme.surfacePanel, borderRadius: 6 }}>
                              <span style={{ flex: 1, fontSize: 12, color: theme.panelTxt }}>
                                <span style={{ fontWeight: 600 }}>{m.student_name}</span>
                                {m.student_handle && (
                                  <span style={{ marginLeft: 6, color: theme.panelTxtMute, fontFamily: theme.fontMono }}>
                                    {userLabel('', m.student_handle)}
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(g.id, m.student_id)}
                                title={t('teacher.removeMember')}
                                style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute }}
                              >
                                <Icon name="trash" size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('sideMenu.loading')}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <ThemedDialog title={t('teacher.createGroup')} onClose={() => { setShowCreate(false); setNewName(''); setError(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.groupName')}</label>
            <input style={inputStyle(theme)} autoFocus placeholder={t('teacher.groupNamePlaceholder')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            {error && <div role="alert" aria-live="polite" style={{ fontSize: 12, color: '#e05' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setError(null); }} style={btnSecondary(theme)}>{t('teacher.cancel')}</button>
              <button type="button" onClick={handleCreate} disabled={submitting} style={btnPrimary(theme)}>{submitting ? t('teacher.creating') : t('teacher.create')}</button>
            </div>
          </div>
        </ThemedDialog>
      )}

      {pendingDelete && (
        <ThemedDialog title={t('teacher.deleteGroup')} onClose={() => setPendingDelete(null)}>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: theme.panelTxt }}>{t('teacher.deleteGroupConfirm', { name: pendingDelete.name })}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setPendingDelete(null)} style={btnSecondary(theme)}>{t('teacher.cancel')}</button>
            <button type="button" onClick={handleDeleteConfirmed} style={{ ...btnPrimary(theme), background: theme.stopBg }}>{t('teacher.deleteGroup')}</button>
          </div>
        </ThemedDialog>
      )}
    </div>
  );
}
