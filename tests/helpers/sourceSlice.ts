/**
 * Safe slicing for the static PHP/TS contract tests.
 *
 * WHY THIS EXISTS
 * These tests verify PHP by reading it, which means carving the source into
 * sections with indexOf(). A plain `src.slice(src.indexOf(a), src.indexOf(b))`
 * fails in three ways, and only one of them is loud:
 *
 *   1. an anchor is missing  -> indexOf returns -1 -> the slice is garbage or empty
 *   2. the anchors are the wrong way round -> the slice is empty
 *   3. the anchor string drifted after a refactor -> the slice is empty
 *
 * `assert.match('', /x/)` fails loudly, so case 1 is usually caught by accident.
 * But `assert.ok(!/x/.test(slice))` and `assert.deepEqual(derived, [])` both PASS
 * on an empty slice. That is a green test that verified nothing - the worst
 * outcome available, because it looks like coverage.
 *
 * sliceBetween() makes the empty-slice case impossible to reach: it throws at the
 * point of the cut, naming the anchors, before any assertion runs.
 */

export interface SliceResult {
  text: string;
  start: number;
  end: number;
}

/**
 * Returns the text between two literal anchors, or throws explaining why it
 * could not. `label` names the section in the error so a failure points at the
 * check that broke rather than at a character offset.
 */
export function sliceBetween(src: string, startAnchor: string, endAnchor: string, label: string): SliceResult {
  const start = src.indexOf(startAnchor);
  if (start < 0) {
    throw new Error(
      `${label}: start anchor not found in the source.\n  looking for: ${JSON.stringify(startAnchor.slice(0, 80))}\n` +
        `  If the code was renamed, update the anchor - do not let this check pass on an empty slice.`
    );
  }
  const end = src.indexOf(endAnchor, start + startAnchor.length);
  if (end < 0) {
    throw new Error(
      `${label}: end anchor not found after the start anchor.\n  looking for: ${JSON.stringify(endAnchor.slice(0, 80))}\n` +
        `  The end anchor must appear AFTER the start anchor in the file.`
    );
  }
  const text = src.slice(start, end);
  if (text.trim() === '') {
    throw new Error(`${label}: the slice between the two anchors is empty.`);
  }
  return { text, start, end };
}

/** Convenience: the text only. */
export function sliceText(src: string, startAnchor: string, endAnchor: string, label: string): string {
  return sliceBetween(src, startAnchor, endAnchor, label).text;
}

/** From an anchor to the end of the file. Throws if the anchor is missing. */
export function sliceToEnd(src: string, startAnchor: string, label: string): string {
  const start = src.indexOf(startAnchor);
  if (start < 0) {
    throw new Error(`${label}: anchor not found: ${JSON.stringify(startAnchor.slice(0, 80))}`);
  }
  const text = src.slice(start);
  if (text.trim() === '') {
    throw new Error(`${label}: nothing after the anchor.`);
  }
  return text;
}

/**
 * Guards the other vacuous-pass shape: a set built from a slice, compared with
 * deepEqual against []. If the slice had no content the derived set is empty and
 * the comparison passes for the wrong reason. Call this before such a comparison.
 *
 * `expected` is the minimum number of items the slice should have yielded.
 */
export function assertNonEmptySet(name: string, items: Iterable<unknown>, expected: number): void {
  const arr = [...items];
  if (arr.length < expected) {
    throw new Error(
      `${name}: expected at least ${expected} item(s) but found ${arr.length}. ` +
        `An empty result here would make the following comparison pass without testing anything.`
    );
  }
}
