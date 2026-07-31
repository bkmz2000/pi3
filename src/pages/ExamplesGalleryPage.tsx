import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useEditor } from '../state/IdeState';
import { Examples } from '../state/exampleProjects';
import { EXAMPLES_CATALOG } from '../data/examplesCatalog';
import { WELCOME_CSS, TopBar, IconOpen } from './welcome/shared';

// Gallery-specific layout on top of the shared marketing CSS (topbar, cta,
// section, card, browse-link, ...) — see src/pages/welcome/shared.tsx.
const GALLERY_CSS = `
.examples-gallery .topic-group { margin-bottom: 40px; }
.examples-gallery .topic-group:last-child { margin-bottom: 0; }
.examples-gallery .topic-group h2 { font-size: 18px; margin: 0 0 4px 0; }
.examples-gallery .topic-lead { font-size: 13.5px; color: var(--ink-mute); margin: 0 0 16px 0; }
.examples-gallery .example-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.examples-gallery .example-card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.examples-gallery .example-card h3 { font-size: 14.5px; margin: 0; }
.examples-gallery .example-card p { font-size: 12.5px; color: var(--ink-mute); margin: 0; line-height: 1.5; flex: 1; }
.examples-gallery .example-open {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
  background: #34a853; color: #fff; border: none; border-radius: 3px;
  padding: 7px 14px; font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.examples-gallery .example-open:hover { background: #2f9549; }
.examples-gallery .example-open svg { width: 13px; height: 13px; }
`;

export function ExamplesGalleryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const openExample = useCallback((key: string) => {
    const project = Examples[key];
    useEditor.getState().changeCurrentProject(project);
    navigate('/ide');
  }, [navigate]);

  return (
    <div className="welcome-root examples-gallery">
      <style>{WELCOME_CSS}</style>
      <style>{GALLERY_CSS}</style>
      <TopBar />

      <section>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0' }}>{t('examplesGallery.title')}</h1>
        <p className="section-lead">{t('examplesGallery.lead')}</p>
        <button type="button" className="browse-link" onClick={() => navigate('/')}>
          {t('examplesGallery.backToHome')}
        </button>
      </section>

      <section>
        {EXAMPLES_CATALOG.map((topic) => (
          <div className="topic-group" key={topic.i18nKey}>
            <h2>{t(`examplesGallery.topics.${topic.i18nKey}.title`)}</h2>
            <p className="topic-lead">{t(`examplesGallery.topics.${topic.i18nKey}.lead`)}</p>
            <div className="example-grid">
              {topic.entries.map((entry) => (
                <div className="example-card" key={entry.key}>
                  <h3>{t(`examplesGallery.entries.${entry.i18nKey}.name`)}</h3>
                  <p>{t(`examplesGallery.entries.${entry.i18nKey}.blurb`)}</p>
                  <button type="button" className="example-open" onClick={() => openExample(entry.key)}>
                    <IconOpen /> {t('welcome.openInEditor')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
