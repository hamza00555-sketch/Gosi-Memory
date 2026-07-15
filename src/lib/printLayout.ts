/**
 * The single source of truth for how a physical card is laid out. The print
 * sheet, the QR-anchor math in the AR stage, and the docs all read these —
 * if the printed QR size changes, the AR scale math follows automatically.
 */

/** Physical card edge (square cards) in millimeters — standard game card width. */
export const CARD_SIZE_MM = 63;

/** QR width as a fraction of the card width (small corner code). */
export const QR_FRACTION = 0.26;

/** Quiet border around the whole face as a fraction of card width. */
export const FACE_MARGIN_FRACTION = 0.04;

/** Print sheet grid (A4 portrait): 3 columns x 4 rows of square cards. */
export const SHEET_COLUMNS = 3;
export const SHEET_ROWS = 4;

/** Pixels per card edge when rasterizing faces for print/compile. */
export const CARD_RASTER_PX = 900;
