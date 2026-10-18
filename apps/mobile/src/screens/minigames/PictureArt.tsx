/**
 * `PictureArt` moved to `components/PictureArt.tsx` (AMENDMENTS-LECTURE-V2 section 5.1, LV-S1: the
 * presenter's reading slides share it). This path re-exports it so the games and open branches that
 * import it from here keep compiling; new code imports `components/PictureArt`.
 */
export { PICTURE_CONTEXT, PictureArt, type PictureArtProps, type PictureArtTile } from '../../components/PictureArt';
