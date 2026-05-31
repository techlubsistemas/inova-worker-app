import { API_URL } from "@/context/AuthContext";
import axios from "axios";

export type TrainingAttachmentKind = "video_upload" | "video_youtube" | "file";

export interface TrainingAttachment {
  id: string;
  kind: TrainingAttachmentKind;
  url: string;
  originalName?: string | null;
}

export interface WorkerTraining {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  completed: boolean;
  attachments: TrainingAttachment[];
}

/** Treinamentos exigidos pela função do colaborador (derivados no servidor). */
export async function fetchMyTrainings(): Promise<WorkerTraining[]> {
  const { data } = await axios.get<{ trainings: WorkerTraining[] }>(
    `${API_URL}/training/worker/me`,
    { timeout: 30_000 },
  );
  return data.trainings ?? [];
}

/** Marca um treinamento como concluído para o colaborador logado. */
export async function completeTraining(trainingId: string): Promise<void> {
  await axios.post(`${API_URL}/training/worker/${trainingId}/complete`, {});
}
