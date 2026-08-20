import type { IntakeData } from "./schema";

export type SubmissionResult = {
  ok: boolean;
  submissionId: string;
  mode: "connected" | "preview";
};

export interface SubmissionProvider {
  submit(data: IntakeData): Promise<SubmissionResult>;
  uploadAsset?(submissionId: string, file: File, category: string): Promise<void>;
}

export class ApiSubmissionProvider implements SubmissionProvider {
  async submit(data: IntakeData): Promise<SubmissionResult> {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", data }),
    });

    if (!response.ok) throw new Error("We couldn't submit your brief just yet.");
    return response.json() as Promise<SubmissionResult>;
  }

  async uploadAsset(submissionId: string, file: File, category: string) {
    const base64 = await fileToBase64(file);
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upload",
        submissionId,
        file: { name: file.name, type: file.type, category, base64 },
      }),
    });
    if (!response.ok) throw new Error(`Could not upload ${file.name}`);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
