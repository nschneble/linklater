import BottomSheetMainPanel from './BottomSheetMainPanel';
import BottomSheetThemeSubmenu from './BottomSheetThemeSubmenu';
import { useMenuNavigation } from './useMenuNavigation';
import { useEffect, useRef, useState } from 'react';
import type { AppView } from '../../lib/navigation';
import type { BaseTheme, Mode } from '../../theme/ThemeContext';
import type { User } from '../../auth/AuthContext';

interface MobileBottomSheetProps {
  user: User;
  view: AppView;
  isOpen: boolean;
  baseTheme: BaseTheme;
  mode: Mode;
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

/**
 * Bottom sheet that slides up from the screen edge on mobile.
 *
 * A semi-transparent scrim covers the page behind the sheet. Tapping the
 * scrim or swiping the drag handle downward closes the sheet. A
 * `menu-open` class is toggled on `document.body` (mobile only) to prevent
 * background scroll — the desktop dropdown shares the same `isOpen` state,
 * so the media-query guard in `index.css` keeps scroll unlocked on larger
 * screens.
 *
 * The sheet contains two panels that alternate via CSS grid 0fr/1fr:
 * - Main panel: nav items, theme trigger row, and logout.
 * - Theme subview: a back button and the flat theme list.
 *
 * Both panels are always mounted; `inert` is applied to the off-screen one
 * so keyboard/pointer events only reach the visible panel.
 *
 * `useMenuNavigation` calls and panel refs stay in this shell — not inside
 * children — so focus management is owned by one component.
 */
export default function MobileBottomSheet({
  user,
  view,
  isOpen,
  baseTheme,
  mode,
  onClose,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: MobileBottomSheetProps) {
  const [showThemeSubview, setShowThemeSubview] = useState(false);
  const mainViewReference = useRef<HTMLDivElement | null>(null);
  const themeViewReference = useRef<HTMLDivElement | null>(null);
  const themeButtonReference = useRef<HTMLButtonElement | null>(null);
  const openerReference = useRef<HTMLElement | null>(null);
  const touchStartY = useRef(0);

  // Modal-dialog contract: Tab must stay inside the sheet (not advance into
  // the inert subtree behind the scrim) so keyboard users do not get
  // stranded on <body>. Both panels use trap behavior.
  useMenuNavigation(mainViewReference, onClose, { tabBehavior: 'trap' });
  useMenuNavigation(themeViewReference, handleBackToMain, {
    tabBehavior: 'trap',
  });

  useEffect(() => {
    const isMobile =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches;

    if (isOpen && isMobile) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }

    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [isOpen]);

  // Capture the trigger that opened the sheet so focus can be restored to
  // it on close. Without this, closing the sheet (Escape, scrim tap, swipe)
  // leaves focus stranded inside the now-inert subtree and the browser
  // falls back to <body>. WAI-ARIA APG dialog pattern.
  useEffect(() => {
    if (isOpen) {
      openerReference.current = document.activeElement as HTMLElement | null;
      return;
    }
    const opener = openerReference.current;
    if (opener && typeof opener.focus === 'function') {
      opener.focus();
    }
    openerReference.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const firstItem =
      mainViewReference.current?.querySelector<HTMLElement>(
        '[role="menuitem"]',
      );
    (firstItem ?? mainViewReference.current)?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!showThemeSubview) return;
    requestAnimationFrame(() => {
      const firstItem =
        themeViewReference.current?.querySelector<HTMLElement>(
          '[role="menuitem"]',
        );
      (firstItem ?? themeViewReference.current)?.focus({ preventScroll: true });
    });
  }, [showThemeSubview]);

  function handleSheetTransitionEnd(
    event: React.TransitionEvent<HTMLDivElement>,
  ) {
    if (event.propertyName === 'transform' && !isOpen) {
      setShowThemeSubview(false);
    }
  }

  function handleBackToMain() {
    setShowThemeSubview(false);
    requestAnimationFrame(() => themeButtonReference.current?.focus());
  }

  function handleDragHandleTouchStart(event: React.TouchEvent) {
    // Multi-finger or synthetic events can dispatch with an empty touches
    // list — accessing `[0].clientY` would throw and crash the sheet.
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    touchStartY.current = firstTouch.clientY;
  }

  function handleDragHandleTouchEnd(event: React.TouchEvent) {
    const lastTouch = event.changedTouches[0];
    if (!lastTouch) return;
    const deltaY = lastTouch.clientY - touchStartY.current;
    if (deltaY > 64) {
      onClose();
    }
  }

  return (
    <div className="md:hidden">
      {/* Scrim: always aria-hidden (decorative backdrop); keyboard close is
          handled by Escape in useMenuNavigation. data-open drives Tailwind.
          Opacity transition is motion-safe so reduced-motion users get an
          instant scrim swap to match the instant panel snap. */}
      <div
        className="fixed inset-0 z-40 scrim motion-safe:transition-opacity motion-safe:duration-300 data-[open=false]:opacity-0 data-[open=false]:pointer-events-none"
        aria-hidden="true"
        data-open={isOpen}
        onClick={onClose}
      />

      <div
        className={`fixed bottom-0 inset-x-0 z-50 max-h-[85svh] overflow-y-auto bg-[var(--orbit-bg)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] ${
          isOpen
            ? 'motion-safe:[transition:transform_300ms_ease-out]'
            : 'motion-safe:[transition:transform_250ms_ease-in]'
        }`}
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          overscrollBehavior: 'contain',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="User menu"
        inert={!isOpen ? true : undefined}
        onTransitionEnd={handleSheetTransitionEnd}
      >
        <div
          className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[var(--orbit-bg)] cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragHandleTouchStart}
          onTouchEnd={handleDragHandleTouchEnd}
        >
          <div
            className="w-10 h-1 rounded-full bg-[var(--orbit-border)]"
            aria-hidden="true"
          />
        </div>

        <div style={{ clipPath: 'inset(0)' }}>
          <div
            className="motion-safe:[transition:transform_300ms_cubic-bezier(0.4,0,0.2,1)]"
            style={{
              display: 'flex',
              width: '200%',
              transform: showThemeSubview
                ? 'translateX(-50%)'
                : 'translateX(0)',
              alignItems: 'flex-start',
              willChange: 'transform',
            }}
          >
            <BottomSheetMainPanel
              user={user}
              view={view}
              baseTheme={baseTheme}
              mode={mode}
              showThemeSubview={showThemeSubview}
              panelReference={mainViewReference}
              themeButtonReference={themeButtonReference}
              onClose={onClose}
              onLogout={onLogout}
              onModeToggle={onModeToggle}
              onShowThemeSubview={() => setShowThemeSubview(true)}
              onViewChange={onViewChange}
            />

            <BottomSheetThemeSubmenu
              baseTheme={baseTheme}
              showThemeSubview={showThemeSubview}
              panelReference={themeViewReference}
              onBack={handleBackToMain}
              onThemeSelect={onThemeSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
