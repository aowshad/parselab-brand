"use client";

/**
 * Browser side of an upload: (1) ask the server for a signed URL, (2) PUT the file straight to
 * storage with progress, (3) ask the server to check and store it. Returns the new file's id.
 * Throws an Error whose message is meant for the admin ("SVG contains scripts and was rejected").
 */
export async function uploadFile(
  file: File,
  opts: { purpose: string; brandId?: string },
  onProgress?: (fraction: number) => void,
): Promise<{ fileId: string; width: number; height: number; kind: string }> {
  const sign = await fetch("/api/admin/uploads/sign/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose: opts.purpose, brandId: opts.brandId, fileName: file.name, size: file.size, type: file.type }),
  });
  const signed = await sign.json().catch(() => ({}));
  if (!sign.ok) throw new Error(signed.error ?? "Couldn't start the upload.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was refused by storage. Try again.")));
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.send(file);
  });
  onProgress?.(1);

  const done = await fetch("/api/admin/uploads/complete/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticketId: signed.ticketId }),
  });
  const result = await done.json().catch(() => ({}));
  if (!done.ok) throw new Error(result.error ?? "The file couldn't be processed.");
  return result;
}
