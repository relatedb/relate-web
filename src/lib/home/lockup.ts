import { WORDMARK } from './brand-art.ts';

// The header lockup: the logomark and the word "relate", with "by Neo4j" centred over the word.
// The word and the attribution cross-fade on hover or focus (base.css), the mark stays put, so
// the lockup is only as wide as "relate". Derived from WORDMARK (the full lockup, still used by
// the diagram) so the artwork stays in one place.
const OPEN = '<g transform="scale(0.116879)">';
const BY_AT = '</g><g transform="translate(169.786 8.258) scale(0.17)">';
const RELATE_W = 158; //  the word ends at ~157.7 units
const WORD_X = 51.6; //   ...and starts at ~51.6 units (the mark is to its left)
const BY_W = 88.7; //     "by Neo4j" spans ~169.8 to 258.5 units
const BY_DX = WORD_X + (RELATE_W - WORD_X) / 2 - BY_W / 2 - 169.786;
const BY_DY = 3.92; //    lowers "by Neo4j" so its lowest ink meets the mark's bottom edge (21.29px at 22px)
const MARK_PATHS = 2; //  the artwork's last two paths are the mark, the rest are the letters

const cut = WORDMARK.indexOf(BY_AT) + '</g>'.length;
const end = WORDMARK.lastIndexOf('</svg>');
const start = WORDMARK.indexOf(OPEN) + OPEN.length;
const paths = WORDMARK.slice(start, cut - '</g>'.length).split('\n');
const letters = paths.slice(0, -MARK_PATHS).join('\n');
const mark = paths.slice(-MARK_PATHS).join('\n');

export const LOCKUP = (
  WORDMARK.slice(0, WORDMARK.indexOf(OPEN)).replace('viewBox="0 1.1 258.53 33.2"', `viewBox="0 1.1 ${RELATE_W} 33.2"`) +
  `<g transform="scale(0.116879)">${mark}</g>` +
  `<g class="lk-relate" transform="scale(0.116879)">${letters}</g>` +
  `<g class="lk-by" transform="translate(${BY_DX.toFixed(2)} ${BY_DY})">${WORDMARK.slice(cut, end)}</g></svg>`
);
