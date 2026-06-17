export type Fetcher = (input: string) => Promise<Response>;

const DRIVE_DOWNLOAD_BASE_URL = 'https://drive.google.com/uc?export=download&id=';

export function extractGoogleDriveFileId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (!url.hostname.includes('drive.google.com')) return null;

    const idFromQuery = url.searchParams.get('id');
    if (idFromQuery) return idFromQuery;

    const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch?.[1]) return filePathMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function createGoogleDriveDownloadUrl(fileId: string): string {
  return `${DRIVE_DOWNLOAD_BASE_URL}${encodeURIComponent(fileId)}`;
}

export async function importGoogleDriveFile(input: string, fetcher: Fetcher = fetch): Promise<File> {
  const fileId = extractGoogleDriveFileId(input);
  if (!fileId) {
    throw new Error('Please paste a valid Google Drive file sharing link.');
  }

  const downloadUrl = createGoogleDriveDownloadUrl(fileId);
  const response = await fetcher(downloadUrl);

  if (!response.ok) {
    throw new Error('Unable to download this Google Drive file. Make sure sharing is set to anyone with the link.');
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const data = await response.arrayBuffer();
  const fileName = getFileNameFromResponse(response) ?? `google-drive-${fileId}${extensionForContentType(contentType)}`;

  return new File([data], fileName, { type: contentType });
}

function getFileNameFromResponse(response: Response): string | null {
  const contentDisposition = response.headers.get('content-disposition');
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].trim());

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  const bareMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (bareMatch?.[1]) return bareMatch[1].trim();

  return null;
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes('epub')) return '.epub';
  if (contentType.includes('pdf')) return '.pdf';
  if (contentType.includes('markdown')) return '.md';
  if (contentType.includes('text/plain')) return '.txt';
  return '';
}
