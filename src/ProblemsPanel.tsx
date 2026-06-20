import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { useUser } from "./state/useUser";
import type { ProblemListItem, BestStars } from "./compete/types";

type Props = {
  onClose: () => void;
};

function StarIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'inline-block' }}>
      <polygon
        points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9 3,11 3.5,7.5 1,5 4.5,4.5"
        fill={filled ? color : 'transparent'}
        stroke={color}
        strokeWidth="1"
      />
    </svg>
  );
}

function StarsDisplay({ count, max = 3, accent }: { count: number; max?: number; accent: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} filled={i < count} color={accent} />
      ))}
    </span>
  );
}

export default function ProblemsPanel({ onClose }: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const navigate = useNavigate();
  const { user } = useUser();
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [bestStars, setBestStars] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    const pFetch = fetch('/api/problems', { credentials: 'include' }).then((r) => r.json() as Promise<ProblemListItem[]>);
    const sFetch = user
      ? fetch('/api/submissions/me', { credentials: 'include' }).then((r) => r.json() as Promise<BestStars[]>)
      : Promise.resolve([] as BestStars[]);

    Promise.all([pFetch, sFetch])
      .then(([probs, stars]) => {
        setProblems(probs);
        const byId: Record<number, number> = {};
        for (const s of stars) byId[s.problem_id] = s.best_stars;
        setBestStars(byId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh when the tab becomes visible again (student just submitted)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData]);

  const handleRowClick = (slug: string) => {
    onClose();
    navigate(`/compete/${slug}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        height: 40, display: "flex", alignItems: "center", gap: 6,
        padding: "0 8px 0 12px", background: theme.panelHeader,
        borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0,
      }}>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 700,
          color: theme.panelTxt, fontFamily: theme.fontUI,
        }}>
          {t("compete.problems")}
        </span>
        <button
          type="button"
          onClick={onClose}
          title={t("sideMenu.close")}
          style={{
            all: "unset", cursor: "pointer", width: 28, height: 28, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: theme.panelTxtMute,
          }}
        >
          <Icon name="close" size={14} color="currentColor" />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: 16, fontSize: 13, color: theme.panelTxtMute, fontFamily: theme.fontUI }}>
            …
          </div>
        )}
        {!loading && problems.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: theme.panelTxtMute, fontFamily: theme.fontUI }}>
            {t("compete.noProblems")}
          </div>
        )}
        {problems.map((p) => {
          const stars = bestStars[p.id] ?? 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleRowClick(p.slug)}
              style={{
                all: 'unset',
                display: 'flex', alignItems: 'center',
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: `1px solid ${theme.panelBorder}`,
                gap: 10,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.chip)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                flex: 1, fontSize: 13.5, fontFamily: theme.fontUI,
                color: theme.panelTxt, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.title}
              </span>
              <StarsDisplay count={stars} accent={theme.accent} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
