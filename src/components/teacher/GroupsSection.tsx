import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import {
  getGroups, createGroup, getGroup, deleteGroup, inviteToGroup,
  type Group, type GroupDetail,
} from '../../state/api';
import { asyncAction } from '../../state/asyncAction';
import { Icon } from '../Icons';
import { ThemedDialog } from '../ThemedDialog';
import { GroupQueueView } from './GroupQueueView';
import { inputStyle, btnPrimary, btnSecondary } from './styles';

export function GroupsSection() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueGroupId, setQueueGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForGroup, setInviteForGroup] = useState<GroupDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setGroups(await getGroups()); } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const g = await createGroup(newName.trim());
      setGroups(prev => [g, ...prev]);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
    setSubmitting(false);
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    const groupToRestore = groups.find(g => g.id === id)!;
    setPendingDelete(null);

    try {
      await asyncAction(() => deleteGroup(id), {
        errorMessage: () => `Failed to delete group "${name}"`,
        onError: () => {
          setGroups(prev => [groupToRestore, ...prev]);
        },
      });
      setGroups(prev => prev.filter(g => g.id !== id));
      if (queueGroupId === id) setQueueGroupId(null);
    } catch {
      // Error already shown by asyncAction
    }
  }

  async function handleInvite() {
    if (!inviteForGroup || !inviteEmail.trim()) return;
    setSubmitting(true); setError(null);
    try {
      await inviteToGroup(inviteForGroup.id, inviteEmail.trim());
      setGroups(prev => prev.map(g => g.id === inviteForGroup.id ? { ...g, member_count: g.member_count + 1 } : g));
      setInviteEmail('');
      setShowInvite(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
    setSubmitting(false);
  }

  if (queueGroupId) {
    const group = groups.find(g => g.id === queueGroupId);
    return <GroupQueueView groupId={queueGroupId} groupName={group?.name ?? ''} onBack={() => setQueueGroupId(null)} />;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>{t('teacher.groups')}</span>
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
          {groups.map(g => (
            <div key={g.id} style={{ border: `1px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}>
              <div
                role="button"
                tabIndex={0}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'transparent' }}
                onClick={() => setQueueGroupId(g.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQueueGroupId(g.id); } }}
              >
                <Icon name="users" size={16} color={theme.panelTxtMute} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 13, color: theme.panelTxt }}>{g.name}</span>
                <span style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.members', { count: g.member_count })}</span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    asyncAction(() => getGroup(g.id), {
                      errorMessage: () => 'Failed to load group details',
                    }).then(detail => {
                      setInviteForGroup(detail);
                      setError(null);
                      setShowInvite(true);
                    }).catch(() => {
                      // Error already shown by asyncAction
                    });
                  }}
                  title={t('teacher.inviteStudent')}
                  style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: 4, fontSize: 12 }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPendingDelete({ id: g.id, name: g.name }); }}
                  title={t('teacher.deleteGroup')}
                  style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: 4 }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ThemedDialog title={t('teacher.createGroup')} onClose={() => { setShowCreate(false); setNewName(''); setError(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.groupName')}</label>
            <input style={inputStyle(theme)} autoFocus placeholder={t('teacher.groupNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            {error && <div role="alert" aria-live="polite" style={{ fontSize: 12, color: '#e05' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setError(null); }} style={btnSecondary(theme)}>{t('teacher.cancel')}</button>
              <button type="button" onClick={handleCreate} disabled={submitting} style={btnPrimary(theme)}>{submitting ? t('teacher.creating') : t('teacher.create')}</button>
            </div>
          </div>
        </ThemedDialog>
      )}

      {showInvite && inviteForGroup && (
        <ThemedDialog title={t('teacher.inviteStudent')} onClose={() => { setShowInvite(false); setInviteEmail(''); setError(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.inviteEmail')}</label>
            <input style={inputStyle(theme)} autoFocus placeholder={t('teacher.inviteEmailPlaceholder')} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} />
            {error && <div role="alert" aria-live="polite" style={{ fontSize: 12, color: '#e05' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowInvite(false); setInviteEmail(''); setError(null); }} style={btnSecondary(theme)}>{t('teacher.cancel')}</button>
              <button type="button" onClick={handleInvite} disabled={submitting} style={btnPrimary(theme)}>{submitting ? t('teacher.inviting') : t('teacher.invite')}</button>
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
