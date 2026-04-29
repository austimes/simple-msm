import { strToU8, zipSync } from 'fflate';
import type { LibraryExportBundle } from './libraryExport.ts';

export function createLibraryExportZip(bundle: LibraryExportBundle): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(bundle.files).map(([path, content]) => [path, strToU8(content)]),
    ),
    { level: 6 },
  );
}

export function downloadLibraryExportBundle(bundle: LibraryExportBundle): void {
  const archive = createLibraryExportZip(bundle);
  const archiveBuffer = new ArrayBuffer(archive.byteLength);
  new Uint8Array(archiveBuffer).set(archive);
  const blob = new Blob([archiveBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = bundle.filename;
  link.click();

  URL.revokeObjectURL(url);
}
