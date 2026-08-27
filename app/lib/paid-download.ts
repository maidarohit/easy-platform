"use client";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

export async function downloadPaidBlob(blob: Blob, filename: string) {
  try {
    const response = await authenticatedFetch("/api/exports", {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream", "X-Export-Filename": filename },
      body: blob,
    });
    if (!response.ok) {
      if (response.status === 403) window.alert("Subscribe to download or export this work.");
      else window.alert("Unable to prepare this download.");
      return false;
    }
    const authorizedBlob = await response.blob();
    const downloadUrl = URL.createObjectURL(authorizedBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    return true;
  } catch {
    window.alert("Unable to prepare this download.");
    return false;
  }
}
