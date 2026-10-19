/** Paperwork rules shared with the API and storage bucket: PDF, JPG or PNG, up to 10 MB. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const documentAccept = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/** Why a picked file can't be uploaded, or undefined when it's fine. */
export function documentProblem(file: File | null) {
  if (!file) return undefined;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "jpg", "jpeg", "png"].includes(extension)) return "Only PDF, JPG or PNG files can be uploaded.";
  if (file.size > MAX_DOCUMENT_BYTES) return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  return undefined;
}
