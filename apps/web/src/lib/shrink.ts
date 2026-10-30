import { MAX_UPLOAD_BYTES } from '@kreators/shared';

/**
 * A picture ready to upload: GIFs go as they are (and must fit), anything else is drawn smaller on a canvas and
 * saved as WebP until it fits under the limit. A video is never uploaded; it is linked.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Pick a picture or a GIF. Link a video instead.');
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('That GIF is over 1 MB. Use a smaller one, or paste a link to it.');
    return file;
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('That picture could not be read.');
  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.82 - attempt * 0.08));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
    scale *= 0.75;
  }
  throw new Error('That picture is too big to shrink enough. Try a smaller one.');
}
