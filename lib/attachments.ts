export type StagedAttachment = {
  filename: string;
  contentType: string;
  content: string; // base64 without data URL prefix
  size: number;
};

const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export async function fileToAttachment(file: File): Promise<StagedAttachment> {
  if (file.size > MAX_TOTAL_BYTES) {
    throw new Error(`${file.name} is too large (max 10 MB)`);
  }
  const base64 = await readFileAsBase64(file);
  return {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    content: base64,
    size: file.size,
  };
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx === -1 ? result : result.slice(idx + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
