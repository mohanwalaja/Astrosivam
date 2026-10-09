/**
 * Choose one shared body size for the eight page-2 cards, with every card
 * sized to its own content.
 *
 * The cards are no longer stretched to four equal rows: each `.life-card-big`
 * grows to fit its own paragraph, so the only real constraint is that the
 * whole content-sized stack (header + disclaimer + cards + footer) still fits
 * one A4 sheet. We binary-search the largest shared size that keeps the page
 * within the sheet — short charts get large, readable text, dense charts a
 * slightly smaller one, never a clipped card.
 *
 * Measure after fonts load and again in the PDF capture clone: Tamil/Devanagari
 * and fallback fonts have different metrics.
 *
 * Keep this function self-contained (including no nested callbacks): its
 * source is also embedded in the standalone HTML preview's script.
 */
export function fitJathagamLifeCardText(root: ParentNode): void {
  const page = root.querySelector<HTMLElement>('#jathagam-page-2');
  const paragraphs = root.querySelectorAll<HTMLElement>('#jathagam-page-2 .life-card-big p');
  if (!page || !paragraphs.length || paragraphs[0].getBoundingClientRect().width === 0) return;
  const doc = paragraphs[0].ownerDocument;
  const view = doc.defaultView;
  if (!view) return;

  // offsetWidth is unscaled layout px: if a sheet scale was applied earlier it
  // must not leak into the mm-to-px factor, because scrollHeight below is
  // measured in the same unscaled layout space.
  const layoutWidth = page.offsetWidth || page.getBoundingClientRect().width;
  const mmToPx = layoutWidth > 0 ? layoutWidth / 210 : 3.78;
  const targetPx = 297 * mmToPx;
  // The sheet is min-height: 297mm and .inner spreads its children, so the
  // sheet's own scrollHeight can never tell us whether the content fits. Read
  // the inner block's natural height instead.
  const inner = page.querySelector<HTMLElement>('.inner') || page.firstElementChild as HTMLElement | null;
  if (!inner) return;
  const pageStyle = view.getComputedStyle(page);
  const verticalPadding = (parseFloat(pageStyle.paddingTop) || 0) + (parseFloat(pageStyle.paddingBottom) || 0);

  const previousHeight = page.style.height;
  const previousOverflow = page.style.overflow;
  const previousInnerHeight = inner.style.height;
  const previousInnerJustify = inner.style.justifyContent;
  const previousInnerFlex = inner.style.flex;
  page.style.height = 'auto';
  page.style.overflow = 'visible';
  inner.style.height = 'auto';
  inner.style.justifyContent = 'flex-start';
  // `.inner` is `flex: 1` inside a `min-height: 297mm` column, so it would be
  // stretched to fill the sheet and its scrollHeight could never report less
  // than a full page. Neutralise the growth while measuring; the content-sized
  // cards are the only thing that decides the stack height.
  inner.style.flex = '0 0 auto';

  const setSize = (size: number) => {
    for (let i = 0; i < paragraphs.length; i++) {
      paragraphs[i].style.fontSize = size + 'px';
    }
  };

  const measure = (size: number): { fitsPage: boolean; fitsCards: boolean } => {
    setSize(size);
    // Leave a small breathing margin for raster rounding and descenders.
    const contentPx = inner.scrollHeight + verticalPadding;
    const fitsPage = contentPx <= targetPx - 4;
    let fitsCards = true;
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const card = paragraph.closest<HTMLElement>('.life-card-big');
      if (!card) continue;
      const cardStyle = view.getComputedStyle(card);
      const cardBounds = card.getBoundingClientRect();
      const bottomLimit = cardBounds.bottom
        - parseFloat(cardStyle.paddingBottom)
        - parseFloat(cardStyle.borderBottomWidth);
      const textBottom = paragraph.getBoundingClientRect().bottom;
      if (textBottom > bottomLimit + 0.5) {
        fitsCards = false;
        break;
      }
    }
    return { fitsPage, fitsCards };
  };

  let low = 10;
  let high = 18;
  let fitted = low;
  // Preferred size first, then a binary search to a tenth of a pixel.
  for (let pass = 0; pass < 9; pass++) {
    const size = pass === 0 ? high : (low + high) / 2;
    const result = measure(size);
    if (result.fitsPage && result.fitsCards) {
      fitted = size;
      low = size;
      if (pass === 0) break;
    } else {
      high = size;
    }
  }

  fitted = Math.floor(fitted * 10) / 10;
  setSize(fitted);

  page.style.height = previousHeight;
  page.style.overflow = previousOverflow;
  inner.style.height = previousInnerHeight;
  inner.style.justifyContent = previousInnerJustify;
  inner.style.flex = previousInnerFlex;
}

/**
 * Enlarge page-3 Short Summary type (and its spacing) until the sheet is
 * full, without ever dropping below the 10.5px floor or spilling a second
 * page.
 *
 * The CSS sizes on `.summary-page` are the floor (`--summary-scale: 1`).
 * Dense charts (five to nine flagged grahas, compact table) stay there;
 * shorter charts scale up so the page is filled with readable text instead
 * of a blank band. The care card is the growing block that absorbs the
 * last millimetres after this fitter returns.
 *
 * Keep this function self-contained: its source is also embedded in the
 * standalone HTML preview's script.
 */
export function fitJathagamSummaryText(root: ParentNode): void {
  const page = root.querySelector<HTMLElement>('#jathagam-page-3');
  if (!page || page.getBoundingClientRect().width === 0) return;
  const doc = page.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;
  const inner = page.querySelector<HTMLElement>('.inner');
  if (!inner) return;
  const care = page.querySelector<HTMLElement>('#summary-care');

  const layoutWidth = page.offsetWidth || page.getBoundingClientRect().width;
  const mmToPx = layoutWidth > 0 ? layoutWidth / 210 : 3.78;
  const targetPx = 297 * mmToPx;
  const pageStyle = view.getComputedStyle(page);
  const verticalPadding = (parseFloat(pageStyle.paddingTop) || 0) + (parseFloat(pageStyle.paddingBottom) || 0);

  const previousHeight = page.style.height;
  const previousOverflow = page.style.overflow;
  const previousInnerHeight = inner.style.height;
  const previousInnerJustify = inner.style.justifyContent;
  const previousInnerFlex = inner.style.flex;
  const previousCareFlex = care ? care.style.flex : '';
  page.style.height = 'auto';
  page.style.overflow = 'visible';
  inner.style.height = 'auto';
  inner.style.justifyContent = 'flex-start';
  inner.style.flex = '0 0 auto';
  if (care) care.style.flex = '0 0 auto';

  const setScale = (scale: number) => {
    page.style.setProperty('--summary-scale', String(scale));
  };

  const fits = (scale: number): boolean => {
    setScale(scale);
    return inner.scrollHeight + verticalPadding <= targetPx - 4;
  };

  // Never shrink below the CSS floor (10.5px). Scale up so a short summary
  // fills the A4 instead of leaving empty space.
  let low = 1;
  let high = 1.7;
  let fitted = 1;
  if (fits(high)) {
    fitted = high;
  } else {
    for (let pass = 0; pass < 10; pass++) {
      const mid = (low + high) / 2;
      if (fits(mid)) {
        fitted = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
  }

  fitted = Math.floor(fitted * 100) / 100;
  if (fitted < 1 || !fits(fitted)) {
    fitted = 1;
    setScale(1);
  } else {
    setScale(fitted);
  }

  page.style.height = previousHeight;
  page.style.overflow = previousOverflow;
  inner.style.height = previousInnerHeight;
  inner.style.justifyContent = previousInnerJustify;
  inner.style.flex = previousInnerFlex;
  if (care) care.style.flex = previousCareFlex;
}
