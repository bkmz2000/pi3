import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../state/useTheme';

/* ------------------------------------------------------------------ */
/*  Responsive breakpoint hook (no CSS files)                         */
/* ------------------------------------------------------------------ */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 719px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 719px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

/* ------------------------------------------------------------------ */
/*  Shared button style helper                                        */
/* ------------------------------------------------------------------ */
function ctaButtonStyle(theme: ReturnType<typeof useThemeStore.getState>['theme']): React.CSSProperties {
  return {
    display: 'inline-block',
    background: theme.accent,
    color: '#1f2933',
    fontFamily: theme.fontUI,
    fontWeight: 700,
    fontSize: 17,
    padding: '12px 32px',
    border: 'none',
    borderRadius: theme.radiusButton,
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  };
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */
function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ padding: '48px 24px', maxWidth: 960, margin: '0 auto', ...style }}>
      {children}
    </section>
  );
}

/* ================================================================== */
/*  1. Top bar                                                         */
/* ================================================================== */
function TopBar() {
  const theme = useThemeStore((s) => s.theme);
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        maxWidth: 960,
        margin: '0 auto',
        fontFamily: theme.fontUI,
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontFamily: theme.fontMono,
          fontSize: 22,
          fontWeight: 700,
          color: theme.accent,
          letterSpacing: '-0.02em',
        }}
      >
        pi3
      </span>

      {/* Lang toggle */}
      <button
        onClick={toggleLang}
        style={{
          background: 'transparent',
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusButton,
          color: theme.panelTxt,
          fontFamily: theme.fontUI,
          fontSize: 13,
          padding: '6px 14px',
          cursor: 'pointer',
        }}
      >
        {i18n.language === 'ru' ? t('welcome.language.en') : t('welcome.language.ru')}
      </button>
    </div>
  );
}

/* ================================================================== */
/*  2. Hero                                                            */
/* ================================================================== */
function Hero() {
  const theme = useThemeStore((s) => s.theme);
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Section>
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: theme.fontUI,
            fontWeight: 700,
            fontSize: 'clamp(28px, 5vw, 44px)',
            color: theme.panelTxt,
            margin: '0 0 16px 0',
            lineHeight: 1.2,
          }}
        >
          {t('welcome.hero.headline')}
        </h1>
        <p
          style={{
            fontFamily: theme.fontUI,
            fontWeight: 500,
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: theme.panelTxtMute,
            maxWidth: 600,
            margin: '0 auto 32px auto',
            lineHeight: 1.5,
          }}
        >
          {t('welcome.hero.subheadline')}
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate('/')}
          style={ctaButtonStyle(theme)}
        >
          {t('welcome.hero.cta')}
        </button>

        {/* Trinket note */}
        <p
          style={{
            fontFamily: theme.fontUI,
            fontWeight: 500,
            fontSize: 14,
            color: theme.panelTxtMute,
            marginTop: 24,
            maxWidth: 520,
            margin: '24px auto 0 auto',
            lineHeight: 1.5,
            padding: '12px 20px',
            background: theme.surfacePanel,
            borderRadius: theme.radiusCard,
            border: `1px solid ${theme.panelBorder}`,
          }}
        >
          {t('welcome.hero.trinketNote')}
        </p>
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  3. What's free forever                                             */
/* ================================================================== */
function FreeForever() {
  const theme = useThemeStore((s) => s.theme);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const cards = [
    { title: t('welcome.free.unlimitedProjects.title'), body: t('welcome.free.unlimitedProjects.body') },
    { title: t('welcome.free.teacherUpgrade.title'), body: t('welcome.free.teacherUpgrade.body') },
    { title: t('welcome.free.noCard.title'), body: t('welcome.free.noCard.body') },
  ];

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 36px 0',
        }}
      >
        {t('welcome.free.title')}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: 24,
        }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            style={{
              background: theme.surfacePanel,
              borderRadius: theme.radiusCard,
              border: `1px solid ${theme.panelBorder}`,
              padding: 28,
            }}
          >
            <h3
              style={{
                fontFamily: theme.fontUI,
                fontWeight: 700,
                fontSize: 18,
                color: theme.panelTxt,
                margin: '0 0 10px 0',
              }}
            >
              {card.title}
            </h3>
            <p
              style={{
                fontFamily: theme.fontUI,
                fontWeight: 500,
                fontSize: 15,
                color: theme.panelTxtMute,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  4. Classroom view demo                                             */
/* ================================================================== */
function ClassroomView() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 20px 0',
        }}
      >
        {t('welcome.classroom.title')}
      </h2>

      <p
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 500,
          fontSize: 16,
          color: theme.panelTxtMute,
          textAlign: 'center',
          maxWidth: 620,
          margin: '0 auto 28px auto',
          lineHeight: 1.5,
        }}
      >
        {t('welcome.classroom.body')}
      </p>

      {/* Placeholder box */}
      <div
        style={{
          border: `2px dashed ${theme.panelBorder}`,
          borderRadius: theme.radiusCard,
          background: theme.surfacePanel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 240,
          fontFamily: theme.fontUI,
          fontSize: 15,
          color: theme.panelTxtMute,
        }}
      >
        {t('welcome.classroom.screenshotPlaceholder')}
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  5. Why pi3 / pedagogy                                              */
/* ================================================================== */
function Pedagogy() {
  const theme = useThemeStore((s) => s.theme);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const codeSample = `from graphics import screen, Colors

screen.background(Colors.midnight_blue)
for x in range(0, 400, 20):
    screen.draw_circle(x, 200, 15, Colors.coral)`;

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 20px 0',
        }}
      >
        {t('welcome.pedagogy.title')}
      </h2>

      <p
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 500,
          fontSize: 16,
          color: theme.panelTxtMute,
          textAlign: 'center',
          maxWidth: 620,
          margin: '0 auto 28px auto',
          lineHeight: 1.5,
        }}
      >
        {t('welcome.pedagogy.body')}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Code card */}
        <div
          style={{
            background: theme.editorBg,
            borderRadius: theme.radiusCard,
            border: `1px solid ${theme.panelBorder}`,
            padding: 24,
            overflow: 'auto',
          }}
        >
          <pre
            style={{
              fontFamily: theme.fontMono,
              fontSize: 14,
              lineHeight: 1.65,
              color: theme.editorTxt,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
{codeSample}
          </pre>
          <p
            style={{
              fontFamily: theme.fontUI,
              fontSize: 13,
              color: theme.panelTxtMute,
              margin: '12px 0 0 0',
            }}
          >
            {t('welcome.pedagogy.codeCaption')}
          </p>
        </div>

        {/* Output description card */}
        <div
          style={{
            background: theme.surfacePanel,
            borderRadius: theme.radiusCard,
            border: `1px solid ${theme.panelBorder}`,
            padding: 28,
          }}
        >
          {/* Simulated output: color bars */}
          <div
            style={{
              background: theme.canvasBg,
              borderRadius: theme.radiusCard,
              minHeight: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Color swatches simulating the output */}
            {['#c44569', '#e69857', '#f0c75e', '#8cc772', '#5fd4dc', '#7c8fd4'].map((c, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${10 + i * 14}%`,
                  top: '50%',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  6. Built for games, not textbooks                                   */
/* ================================================================== */
function BuiltForGames() {
  const theme = useThemeStore((s) => s.theme);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const chips = [
    { title: t('welcome.builtForGames.chip1.title'), body: t('welcome.builtForGames.chip1.body') },
    { title: t('welcome.builtForGames.chip2.title'), body: t('welcome.builtForGames.chip2.body') },
    { title: t('welcome.builtForGames.chip3.title'), body: t('welcome.builtForGames.chip3.body') },
  ];

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 16px 0',
        }}
      >
        {t('welcome.builtForGames.title')}
      </h2>
      <p
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 500,
          fontSize: 16,
          color: theme.panelTxtMute,
          textAlign: 'center',
          maxWidth: 640,
          margin: '0 auto 28px auto',
          lineHeight: 1.5,
        }}
      >
        {t('welcome.builtForGames.intro')}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: 24,
        }}
      >
        {chips.map((chip, i) => (
          <div
            key={i}
            style={{
              background: theme.surfacePanel,
              borderRadius: theme.radiusCard,
              border: `1px solid ${theme.panelBorder}`,
              borderLeft: `4px solid ${theme.accent}`,
              padding: 24,
            }}
          >
            <h3
              style={{
                fontFamily: theme.fontUI,
                fontWeight: 700,
                fontSize: 17,
                color: theme.panelTxt,
                margin: '0 0 10px 0',
              }}
            >
              {chip.title}
            </h3>
            <p
              style={{
                fontFamily: theme.fontUI,
                fontWeight: 500,
                fontSize: 14,
                color: theme.panelTxtMute,
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              {chip.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  7. Example games shipped in the tool                               */
/* ================================================================== */
function ExampleGames() {
  const theme = useThemeStore((s) => s.theme);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const cards = [
    { title: t('welcome.exampleGames.card1.title'), body: t('welcome.exampleGames.card1.body') },
    { title: t('welcome.exampleGames.card2.title'), body: t('welcome.exampleGames.card2.body') },
    { title: t('welcome.exampleGames.card3.title'), body: t('welcome.exampleGames.card3.body') },
    { title: t('welcome.exampleGames.card4.title'), body: t('welcome.exampleGames.card4.body') },
  ];

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 16px 0',
        }}
      >
        {t('welcome.exampleGames.title')}
      </h2>
      <p
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 500,
          fontSize: 16,
          color: theme.panelTxtMute,
          textAlign: 'center',
          maxWidth: 640,
          margin: '0 auto 28px auto',
          lineHeight: 1.5,
        }}
      >
        {t('welcome.exampleGames.intro')}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 24,
        }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            style={{
              background: theme.surfacePanel,
              borderRadius: theme.radiusCard,
              border: `1px solid ${theme.panelBorder}`,
              overflow: 'hidden',
            }}
          >
            {/* Screenshot placeholder */}
            <div
              style={{
                background: theme.chip,
                borderBottom: `1px solid ${theme.panelBorder}`,
                minHeight: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.fontUI,
                fontSize: 14,
                color: theme.panelTxtMute,
              }}
            >
              {t('welcome.exampleGames.screenshotPlaceholder')}
            </div>
            {/* Card text */}
            <div style={{ padding: 20 }}>
              <h3
                style={{
                  fontFamily: theme.fontUI,
                  fontWeight: 700,
                  fontSize: 17,
                  color: theme.panelTxt,
                  margin: '0 0 8px 0',
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontFamily: theme.fontUI,
                  fontWeight: 500,
                  fontSize: 14,
                  color: theme.panelTxtMute,
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {card.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  8. Honest migration note                                            */
/* ================================================================== */
function MigrationNote() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 20px 0',
        }}
      >
        {t('welcome.migration.title')}
      </h2>
      <p
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 500,
          fontSize: 16,
          color: theme.panelTxtMute,
          textAlign: 'center',
          maxWidth: 660,
          margin: '0 auto',
          lineHeight: 1.6,
        }}
      >
        {t('welcome.migration.body')}
      </p>
    </Section>
  );
}

/* ================================================================== */
/*  9. FAQ accordion                                                    */
/* ================================================================== */
function FAQ() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const items = [
    { q: t('welcome.faq.q1'), a: t('welcome.faq.a1') },
    { q: t('welcome.faq.q2'), a: t('welcome.faq.a2') },
    { q: t('welcome.faq.q3'), a: t('welcome.faq.a3') },
    { q: t('welcome.faq.q4'), a: t('welcome.faq.a4') },
  ];

  return (
    <Section>
      <h2
        style={{
          fontFamily: theme.fontUI,
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: theme.panelTxt,
          textAlign: 'center',
          margin: '0 0 36px 0',
        }}
      >
        {t('welcome.faq.title')}
      </h2>

      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {items.map((item, i) => (
          <details
            key={i}
            style={{
              borderBottom: `1px solid ${theme.panelBorder}`,
              fontFamily: theme.fontUI,
              padding: '12px 0',
            }}
          >
            <summary
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: theme.panelTxt,
                cursor: 'pointer',
                padding: '8px 0',
                outline: 'none',
              }}
            >
              {item.q}
            </summary>
            <p
              style={{
                fontSize: 15,
                color: theme.panelTxtMute,
                lineHeight: 1.6,
                margin: '0 0 16px 0',
                paddingLeft: 4,
              }}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  10. Footer CTA                                                      */
/* ================================================================== */
function FooterCTA() {
  const theme = useThemeStore((s) => s.theme);
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Section style={{ textAlign: 'center', paddingBottom: 64 }}>
      <button
        onClick={() => navigate('/')}
        style={ctaButtonStyle(theme)}
      >
        {t('welcome.footer.cta')}
      </button>

      <div style={{ marginTop: 24 }}>
        {/* TODO: replace href with real Reddit thread URL */}
        <a
          href="#"
          style={{
            fontFamily: theme.fontUI,
            fontSize: 14,
            color: theme.panelTxtMute,
            textDecoration: 'underline',
          }}
        >
          {t('welcome.footer.feedbackLinkPlaceholder')}
        </a>
      </div>
    </Section>
  );
}

/* ================================================================== */
/*  WelcomePage (main export)                                          */
/* ================================================================== */
export function WelcomePage() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        background: theme.appBg,
        color: theme.panelTxt,
        fontFamily: theme.fontUI,
        fontWeight: 500,
      }}
    >
      <TopBar />
      <Hero />
      <FreeForever />
      <ClassroomView />
      <Pedagogy />
      <BuiltForGames />
      <ExampleGames />
      <MigrationNote />
      <FAQ />
      <FooterCTA />
    </div>
  );
}
