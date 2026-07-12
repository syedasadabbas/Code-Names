// Picture card pool for the Codenames: Pictures variant.
// The image assets live in public/pictures/cards/card-<id>.jpg and are served by
// Next.js from the site root. See public/pictures/ATTRIBUTION.md for provenance.

export const PICTURE_CARD_COUNT = 280;

/** Public URL for a picture card by numeric id (0..PICTURE_CARD_COUNT-1). */
export function picturePath(id: number): string {
  return `/pictures/cards/card-${id}.jpg`;
}

/** The full pool of picture ids to draw a board from. */
export function pictureIds(): number[] {
  return Array.from({ length: PICTURE_CARD_COUNT }, (_, i) => i);
}
