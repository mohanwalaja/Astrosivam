/**
 * ASTRO SIVAM Security, Anti-Copy & Screenshot Ban Protection System
 * Provides client-side protection against unauthorized screenshots, screen snipping,
 * content copying, inspection, scraping, and tampering.
 */

export function initSecurityProtection(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Console Security Warning
  try {
    const bannerStyle = 'color: #f59e0b; font-size: 16px; font-weight: bold; background: #0f172a; padding: 8px 14px; border-radius: 6px; border: 1px solid #f59e0b;';
    const textStyle = 'color: #ef4444; font-size: 13px; font-weight: bold; line-height: 1.5;';
    console.clear();
    console.log('%c⚡ ASTRO SIVAM SECURE ENCRYPTED SYSTEM ⚡', bannerStyle);
    console.log(
      '%cSTOP! Screenshots, screen recording, copying, and automated scraping are strictly prohibited and monitored.',
      textStyle
    );
  } catch (e) {}

  // Helper to check if event target is an interactive user input
  const isEditableElement = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tagName = (el.tagName || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    if (el.isContentEditable) return true;
    if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
    return false;
  };

  // Helper to clear clipboard on screenshot attempt
  const wipeClipboard = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('').catch(() => {});
      }
    } catch (err) {}
  };

  // Temporary security flash notification on screenshot attempt
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  const showScreenshotBlockedAlert = () => {
    wipeClipboard();
    let alertEl = document.getElementById('astro-screenshot-blocked-alert');
    if (!alertEl) {
      alertEl = document.createElement('div');
      alertEl.id = 'astro-screenshot-blocked-alert';
      alertEl.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        background: rgba(15, 23, 42, 0.95);
        border: 2px solid #ef4444;
        color: #ffffff;
        padding: 12px 24px;
        border-radius: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: none;
        transition: opacity 0.3s ease;
      `;
      alertEl.innerHTML = `
        <span style="font-size: 18px;">🛡️</span>
        <span>Screenshots are disabled for privacy & copyright protection.</span>
      `;
      document.body.appendChild(alertEl);
    }
    alertEl.style.opacity = '1';
    alertEl.style.display = 'flex';

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (alertEl) {
        alertEl.style.opacity = '0';
        setTimeout(() => {
          if (alertEl) alertEl.style.display = 'none';
        }, 300);
      }
    }, 2500);
  };

  // 2. Disable Right-Click Context Menu (Permit on inputs only)
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    if (isEditableElement(e.target)) {
      return; // Allow standard cut/copy/paste inside actual text inputs
    }
    e.preventDefault();
  }, { capture: true });

  // 3. Disable Drag-and-Drop of Images and Text Assets
  document.addEventListener('dragstart', (e: DragEvent) => {
    if (!isEditableElement(e.target)) {
      e.preventDefault();
    }
  }, { capture: true });

  // 4. Disable DevTools, PrintScreen, Snipping Tools & Screenshot Shortcuts
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = (e.key || '').toLowerCase();
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // A. PrintScreen (PrtScn) / SysRq
    if (e.key === 'PrintScreen' || e.keyCode === 44 || key === 'printscreen') {
      e.preventDefault();
      e.stopPropagation();
      showScreenshotBlockedAlert();
      wipeClipboard();
      return false;
    }

    // B. Windows Snipping Tool (Win + Shift + S) or Mac Screenshot (Cmd + Shift + 3 / 4 / 5)
    if (e.shiftKey && (isCtrlOrCmd || e.metaKey) && (key === 's' || key === '3' || key === '4' || key === '5')) {
      e.preventDefault();
      e.stopPropagation();
      showScreenshotBlockedAlert();
      wipeClipboard();
      return false;
    }

    // C. Ctrl+P / Cmd+P (Browser Print / Save as PDF capture)
    if (isCtrlOrCmd && key === 'p') {
      // If triggered outside the official download button, prevent browser print
      e.preventDefault();
      e.stopPropagation();
      showScreenshotBlockedAlert();
      return false;
    }

    // D. F12 key
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // E. Ctrl+Shift+I / Cmd+Opt+I (Developer Tools)
    //    Ctrl+Shift+J / Cmd+Opt+J (Console)
    //    Ctrl+Shift+C / Cmd+Opt+C (Inspect Element)
    if (isCtrlOrCmd && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // F. Ctrl+U / Cmd+Opt+U (View Page Source)
    if (isCtrlOrCmd && key === 'u') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // G. Ctrl+S / Cmd+S (Save Page HTML/Assets)
    if (isCtrlOrCmd && key === 's') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // H. Ctrl+A (Select All) outside of editable fields
    if (isCtrlOrCmd && key === 'a' && !isEditableElement(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // I. Ctrl+C (Copy) outside of editable fields
    if (isCtrlOrCmd && key === 'c' && !isEditableElement(e.target)) {
      try {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          selection.removeAllRanges();
        }
      } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 5. Intercept keyup for PrintScreen key to wipe clipboard
  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.key === 'PrintScreen' || e.keyCode === 44 || (e.key || '').toLowerCase() === 'printscreen') {
      showScreenshotBlockedAlert();
      wipeClipboard();
    }
  }, { capture: true });

  // 6. Anti-Snipping Tool Protection on Window Blur / Focus Loss
  // When an external screen capture or snipping utility is active, obscure content
  window.addEventListener('blur', () => {
    document.body.classList.add('astro-screen-obscured');
    wipeClipboard();
  });

  window.addEventListener('focus', () => {
    document.body.classList.remove('astro-screen-obscured');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.classList.add('astro-screen-obscured');
      wipeClipboard();
    } else {
      document.body.classList.remove('astro-screen-obscured');
    }
  });

  // 7. Apply Anti-Selection & Anti-Screenshot Styles to Page Layout
  try {
    const styleEl = document.createElement('style');
    styleEl.id = 'astro-security-styles';
    styleEl.textContent = `
      /* Protect site images from unauthorized drag & drop saving */
      img, svg, canvas {
        -webkit-user-drag: none;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
      }
      /* Prevent unauthorized mass selection across reports, cards and text */
      .protected-content, .page, .life-grid-big, .rasi-grid {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      /* Ensure user form fields remain completely editable on all mobile & desktop browsers */
      input, textarea, select, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
        touch-action: manipulation !important;
        pointer-events: auto !important;
      }
      /* Screen obscuring during snipping tool / focus loss */
      body.astro-screen-obscured .protected-content,
      body.astro-screen-obscured .page,
      body.astro-screen-obscured .rasi-grid,
      body.astro-screen-obscured .life-grid-big {
        filter: blur(14px) grayscale(100%);
        transition: filter 0.1s ease;
      }
      /* Block raw browser print capturing */
      @media print {
        body:not(.allow-print) {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  } catch (e) {}
}
