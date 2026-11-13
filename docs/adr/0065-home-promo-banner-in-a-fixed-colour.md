# ADR-0065: The home hero carries one promo banner in its own fixed colour

Status: Proposed

Date: 2026-11-13

## Context

The home page had a one-line announcement pill in the hero for the hackathon: a chip, a
sentence and a Join link. The campaign now needs a prize, a deadline, an invitation and
artwork, which is more than a pill carries at any width.

The design system (ADR-0043) keeps every colour in one token set with a Day and a Night
value, and the site's rule is that a page composes tokens rather than naming a colour. The
campaign's green is one of the four colours the logomark is drawn with; it is not a token,
and the greens the themes do carry change value between Day and Night, so none of them can
hold a colour that must stay the same in both.

Two constraints come from the site's build. There is no image pipeline: `public/` is copied
to the output untouched and nothing transforms what is committed, so the file a visitor
downloads is the file in the repository. And the tone contract in `MAINTAINING.md` applies
to the home page as much as anywhere, so a prize and a deadline do not license marketing
language.

## Decision

The hero carries exactly one promo banner, above the headline and inside the hero column: the
artwork, a headline, one sentence and one link to the campaign page. It is the only surface
on the site whose fill is a fixed colour.

Two tokens, `--promo` for the fill and `--on-promo` for what sits on it, are declared once
outside the Day and Night token blocks, so the banner is the same green in both themes. Text
on the fill uses `--on-promo`, the near-black the Day theme's ink already is: that pair is
about ten to one, where the same fill against white is under two. The link is the inverse of
the banner, filled with `--on-promo` and lettered in `--promo`.

The artwork is committed as a derivative of the supplied illustration: downscaled to 640
pixels on its long edge and encoded as WebP, which brings it from about 1.2 MB to under
50 KB, with its intrinsic width and height in the markup so the hero does not shift while it
loads and an empty `alt` because the sentence already carries the message.

The banner is time-boxed. It comes down after the campaign's submission deadline, the
tokens with it, and `LAUNCH.md` holds the removal step so the deadline is not remembered in
one place only. It is not dismissible and it runs no script.

On narrow screens the artwork sits above the copy; from 720 pixels it sits beside the copy.
The copy follows the tone contract: no exclamation marks, no superlatives, one call to
action.

## Alternatives considered

- **Reuse `--success` for the fill.** Rejected: it is within rounding of this green in Night
  but it is a dark forest green in Day, so the campaign's colour would change with the
  theme, and the token means status rather than campaign.
- **Name the colour in the hero's own style block.** Rejected: the token rule exists so a
  colour changes in one place and so the Day and Night pairs stay legible; one exception
  starts a second convention.
- **Let the banner follow the theme** (brand colour by day, a deep green by night). Rejected:
  the artwork is drawn on this green, and a promo that recolours itself reads as part of the
  palette rather than as campaign material.
- **Keep the pill and add a line.** Rejected: a headline, a sentence, a prize and a deadline
  do not fit at 390 pixels, and the pill was already hiding its middle text there.
- **Ship the supplied 1254-pixel PNG.** Rejected: 1.2 MB on the first screen of the home
  page for an image shown at about 200 pixels.
- **Redraw the artwork in the brand-art module.** Not available: it is a supplied raster
  illustration rather than a shape drawn here, so it stays a raster file.
- **A full-bleed band between the top bar and the hero.** Rejected: it competes with the top
  bar and pushes the headline below the fold on a laptop.

## Consequences

- The banner is the only place a page meets a fixed colour; that pair of tokens is not for
  general use, and another campaign surface needs its own record.
- Both tokens are removed with the banner. A leftover pair would be a colour with no meaning.
- The artwork is the largest image the home page ships. Keeping a new one small is a review
  point, not a check.
- The home page has no browser check, so the banner's two layouts, both themes and the link
  are confirmed by hand; the `LAUNCH.md` item names them.
- The event's name is capitalised as the campaign's own name inside the banner's sentence,
  which is the one home-page exception to `relate` in lowercase.
