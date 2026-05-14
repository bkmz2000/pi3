import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useUser } from '../../state/useUser';
import { useNotifications } from '../../state/useNotifications';
import {
  getGroups, createGroup, getGroup, deleteGroup, inviteToGroup,
  getSharedProjects, getGroupHelpRequests, addressHelpRequest, markHelpRequestInProgress,
  type Group, type GroupDetail, type SharedProject, type HelpRequest,
} from '../../state/api';
import { Icon } from '../Icons';

type Section = 'groups' | 'projects' | 'help';

// ── Small dialog ────────────────────────────────────────────────────────────
function Dialog({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{
        background: theme.surfacePanel,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 10,
        padding: 24,
        minWidth: 320,
        maxWidth: 440,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>{title}</span>
          <button type="button" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Nav section ─────────────────────────────────────────────────────────────
function NavItem({
  label, active, onClick, theme,
}: { label: string; active: boolean; onClick: () => void; theme: ReturnType<typeof useThemeStore.getState>['theme'] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'block', width: '100%',
        padding: '9px 16px',
        borderRadius: 6,
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? theme.railIconActive : theme.panelTxt,
        background: active ? theme.railActiveBg : 'transparent',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}

// ── Group queue view ─────────────────────────────────────────────────────────
function GroupQueueView({
  groupId, groupName, onBack, theme,
}: {
  groupId: string;
  groupName: string;
  onBack: () => void;
  theme: ReturnType<typeof useThemeStore.getState>['theme'];
}) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const reqs = await getGroupHelpRequests(groupId);
      setRequests(reqs);
      setSelectedId(reqs[0]?.id ?? null);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [groupId]);

  async function handleResolve(id: string) {
    setActing(true);
    try {
      await addressHelpRequest(id);
      setRequests(prev => {
        const next = prev.filter(r => r.id !== id);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch { /* ignore */ }
    setActing(false);
  }

  async function handleInProgress(id: string) {
    setActing(true);
    try {
      await markHelpRequestInProgress(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'in_progress' } : r));
    } catch { /* ignore */ }
    setActing(false);
  }

  const selected = requests.find(r => r.id === selectedId) ?? null;

  const btnPrimary = {
    all: 'unset' as const, cursor: 'pointer',
    padding: '6px 14px', borderRadius: 6,
    background: theme.runBg, color: theme.runTxt,
    fontSize: 12, fontWeight: 600,
    opacity: acting ? 0.6 : 1,
  };

  const btnSecondary = {
    all: 'unset' as const, cursor: 'pointer',
    padding: '6px 14px', borderRadius: 6,
    background: theme.railActiveBg, color: theme.panelTxt,
    fontSize: 12, fontWeight: 500,
    opacity: acting ? 0.6 : 1,
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: queue panel */}
      <div style={{
        width: 260, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${theme.panelBorder}`,
        background: theme.surfacePanel,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${theme.panelBorder}` }}>
          <button
            type="button"
            onClick={onBack}
            style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}
          >
            ← {t('teacher.backToGroups')}
          </button>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.panelTxt, marginBottom: 2 }}>{groupName}</div>
          <div style={{ fontSize: 11, color: theme.panelTxtMute }}>{t('teacher.requestQueue')}</div>
        </div>

        {/* Action buttons for selected (top of queue) */}
        {selected && (
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.panelBorder}`, display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={acting}
              onClick={() => handleResolve(selected.id)}
              style={btnPrimary}
            >
              {t('teacher.resolve')}
            </button>
            {selected.status === 'pending' && (
              <button
                type="button"
                disabled={acting}
                onClick={() => handleInProgress(selected.id)}
                style={btnSecondary}
              >
                {t('teacher.inProgress')}
              </button>
            )}
          </div>
        )}

        {/* Request list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 14, color: theme.panelTxtMute, fontSize: 13 }}>{t('sideMenu.loading')}</div>
          ) : requests.length === 0 ? (
            <div style={{ padding: 14, color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noQueueRequests')}</div>
          ) : (
            requests.map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.panelBorder}`,
                  background: selectedId === r.id ? theme.railActiveBg : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: theme.panelTxt }}>{r.student_name}</span>
                  {r.status === 'in_progress' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                      background: 'rgba(0,120,255,0.15)', color: theme.railIconActive,
                    }}>
                      {t('teacher.inProgress')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{r.project_name}</div>
                <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 2 }}>
                  {t('teacher.requestedAt')} {new Date(r.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: selected request details */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {selected ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: theme.panelTxt, marginBottom: 6 }}>
              {selected.student_name}
            </div>
            <div style={{ fontSize: 14, color: theme.panelTxtMute, marginBottom: 4 }}>{selected.project_name}</div>
            <div style={{ fontSize: 12, color: theme.panelTxtMute, marginBottom: 20 }}>
              {new Date(selected.created_at).toLocaleString()}
            </div>
            {selected.status === 'in_progress' && (
              <div style={{
                marginBottom: 20,
                padding: '8px 14px',
                borderRadius: 6,
                background: 'rgba(0,120,255,0.1)',
                border: `1px solid rgba(0,120,255,0.2)`,
                fontSize: 13, color: theme.railIconActive,
              }}>
                {t('teacher.inProgress')} — student can now add comments.
              </div>
            )}
            <a
              href={`/teacher/projects/${selected.project_id}`}
              style={{
                display: 'inline-block',
                padding: '8px 18px', borderRadius: 6,
                background: theme.railActiveBg, color: theme.panelTxt,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
              }}
            >
              {t('teacher.review')} →
            </a>
          </div>
        ) : !loading && (
          <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noQueueRequests')}</div>
        )}
      </div>
    </div>
  );
}

// ── Groups section ───────────────────────────────────────────────────────────
function GroupsSection({ theme }: { theme: ReturnType<typeof useThemeStore.getState>['theme'] }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueGroupId, setQueueGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForGroup, setInviteForGroup] = useState<GroupDetail | null>(null);
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

  async function handleDelete(id: string, name: string) {
    if (!confirm(t('teacher.deleteGroupConfirm', { name }))) return;
    await deleteGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));
    if (queueGroupId === id) setQueueGroupId(null);
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

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: theme.surface, border: `1px solid ${theme.panelBorder}`,
    borderRadius: 6, padding: '8px 10px',
    color: theme.panelTxt, fontSize: 13,
    fontFamily: theme.fontUI,
    outline: 'none',
  };

  const btnPrimary = {
    all: 'unset' as const, cursor: 'pointer',
    padding: '7px 16px', borderRadius: 6,
    background: theme.runBg, color: theme.runTxt,
    fontSize: 13, fontWeight: 600,
  };

  const btnSecondary = {
    all: 'unset' as const, cursor: 'pointer',
    padding: '7px 14px', borderRadius: 6,
    background: theme.railActiveBg, color: theme.panelTxt,
    fontSize: 13,
  };

  if (queueGroupId) {
    const group = groups.find(g => g.id === queueGroupId);
    return (
      <GroupQueueView
        groupId={queueGroupId}
        groupName={group?.name ?? ''}
        onBack={() => setQueueGroupId(null)}
        theme={theme}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>
          {t('teacher.groups')}
        </span>
        <button type="button" onClick={() => setShowCreate(true)} style={btnPrimary}>
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
            <div
              key={g.id}
              style={{ border: `1px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  background: 'transparent',
                }}
                onClick={() => setQueueGroupId(g.id)}
              >
                <Icon name="users" size={16} color={theme.panelTxtMute} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 13, color: theme.panelTxt }}>{g.name}</span>
                <span style={{ fontSize: 12, color: theme.panelTxtMute }}>
                  {t('teacher.members', { count: g.member_count })}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    getGroup(g.id).then(detail => {
                      setInviteForGroup(detail);
                      setError(null);
                      setShowInvite(true);
                    });
                  }}
                  title={t('teacher.inviteStudent')}
                  style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: 4, fontSize: 12 }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleDelete(g.id, g.name); }}
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

      {/* Create group dialog */}
      {showCreate && (
        <Dialog title={t('teacher.createGroup')} onClose={() => { setShowCreate(false); setNewName(''); setError(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.groupName')}</label>
            <input
              style={inputStyle}
              autoFocus
              placeholder={t('teacher.groupNamePlaceholder')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            {error && <div style={{ fontSize: 12, color: '#e05' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setError(null); }} style={btnSecondary}>
                {t('teacher.cancel')}
              </button>
              <button type="button" onClick={handleCreate} disabled={submitting} style={btnPrimary}>
                {submitting ? t('teacher.creating') : t('teacher.create')}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Invite dialog */}
      {showInvite && inviteForGroup && (
        <Dialog title={t('teacher.inviteStudent')} onClose={() => { setShowInvite(false); setInviteEmail(''); setError(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.inviteEmail')}</label>
            <input
              style={inputStyle}
              autoFocus
              placeholder={t('teacher.inviteEmailPlaceholder')}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            {error && <div style={{ fontSize: 12, color: '#e05' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowInvite(false); setInviteEmail(''); setError(null); }} style={btnSecondary}>
                {t('teacher.cancel')}
              </button>
              <button type="button" onClick={handleInvite} disabled={submitting} style={btnPrimary}>
                {submitting ? t('teacher.inviting') : t('teacher.invite')}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ── Student Projects section ─────────────────────────────────────────────────
function StudentProjectsSection({ theme }: { theme: ReturnType<typeof useThemeStore.getState>['theme'] }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSharedProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grouped = projects.reduce<Record<string, SharedProject[]>>((acc, p) => {
    const key = p.group_name || t('teacher.ungrouped');
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: theme.panelTxt, marginBottom: 16 }}>
        {t('teacher.studentProjects')}
      </div>
      {loading ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('sideMenu.loading')}</div>
      ) : projects.length === 0 ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noSharedProjects')}</div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              {group}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {items.map(p => (
                <div key={p.id} style={{
                  border: `1px solid ${p.help_request_id ? theme.tabDirty : theme.panelBorder}`,
                  borderRadius: 8, padding: '12px 14px',
                  background: theme.surfacePanel,
                }}>
                  {p.help_request_id && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.tabDirty, marginBottom: 4 }}>
                      ✋ {t('teacher.needsHelp')}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 13, color: theme.panelTxt, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{p.student_name}</div>
                  <a
                    href={`/teacher/projects/${p.id}`}
                    style={{
                      display: 'inline-block', marginTop: 10,
                      fontSize: 12, color: theme.railIconActive,
                      textDecoration: 'none', fontWeight: 500,
                    }}
                  >
                    {t('teacher.review')} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Help Requests section ─────────────────────────────────────────────────────
function HelpRequestsSection({ theme }: { theme: ReturnType<typeof useThemeStore.getState>['theme'] }) {
  const { t } = useTranslation();
  const { helpRequests, lastPolledAt, error, refresh, address } = useNotifications();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>
          {t('teacher.helpRequests')}
          {helpRequests.length > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 700,
              background: theme.tabDirty, color: '#fff',
              borderRadius: 99, padding: '1px 7px',
            }}>
              {helpRequests.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={refresh}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute }}
          title={lastPolledAt ? new Date(lastPolledAt).toLocaleTimeString() : ''}
        >
          ↻
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: '#e05', marginBottom: 8 }}>{error}</div>}
      {helpRequests.length === 0 ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noHelpRequests')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {helpRequests.map(hr => (
            <div key={hr.id} style={{
              border: `1px solid ${theme.panelBorder}`, borderRadius: 8,
              padding: '12px 14px', background: theme.surfacePanel,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: theme.panelTxt }}>{hr.student_name}</div>
                <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{hr.project_name}</div>
                <div style={{ fontSize: 11, color: theme.panelTxtMute }}>
                  {new Date(hr.created_at).toLocaleTimeString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={`/teacher/projects/${hr.project_id}`}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    fontSize: 12, padding: '5px 10px', borderRadius: 5,
                    background: theme.railActiveBg, color: theme.panelTxt,
                    fontWeight: 500,
                  }}
                >
                  {t('teacher.review')}
                </a>
                <button
                  type="button"
                  onClick={() => address(hr.id)}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    fontSize: 12, padding: '5px 10px', borderRadius: 5,
                    background: theme.runBg, color: theme.runTxt,
                    fontWeight: 600,
                  }}
                >
                  {t('teacher.addressed')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user } = useUser();
  const [section, setSection] = useState<Section>('groups');
  const { helpRequests } = useNotifications();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: theme.surface,
      fontFamily: theme.fontUI,
      color: theme.panelTxt,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, flex: 'none',
        display: 'flex', alignItems: 'center',
        padding: '0 20px',
        background: theme.railBg,
        borderBottom: `1px solid ${theme.panelBorder}`,
        gap: 12,
      }}>
        <a
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: theme.railIcon, textDecoration: 'none',
            fontSize: 12.5, fontWeight: 500,
            padding: '6px 10px', borderRadius: 5,
          }}
        >
          <Icon name="close" size={14} color="currentColor" />
          {t('teacher.backToIde')}
        </a>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 700, fontSize: 18, color: theme.railLogo }}>
          pi<span style={{ fontSize: 12 }}>3</span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: theme.railIconActive }}>
          {t('teacher.dashboard')}
        </span>
      </div>

      {user && user.role !== 'teacher' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: theme.panelTxtMute, fontSize: 14 }}>
          {t('teacher.notTeacher')}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left nav */}
          <div style={{
            width: 200, flex: 'none',
            background: theme.surfacePanel,
            borderRight: `1px solid ${theme.panelBorder}`,
            padding: '12px 8px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <NavItem label={t('teacher.groups')} active={section === 'groups'} onClick={() => setSection('groups')} theme={theme} />
            <NavItem label={t('teacher.studentProjects')} active={section === 'projects'} onClick={() => setSection('projects')} theme={theme} />
            <div style={{ position: 'relative' }}>
              <NavItem label={t('teacher.helpRequests')} active={section === 'help'} onClick={() => setSection('help')} theme={theme} />
              {helpRequests.length > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 8,
                  width: 8, height: 8, borderRadius: 99,
                  background: theme.tabDirty, pointerEvents: 'none',
                }} />
              )}
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {section === 'groups' && <GroupsSection theme={theme} />}
            {section === 'projects' && (
              <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
                <StudentProjectsSection theme={theme} />
              </div>
            )}
            {section === 'help' && (
              <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
                <HelpRequestsSection theme={theme} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
