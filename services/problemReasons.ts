import { API_URL } from "@/context/AuthContext";
import axios from "axios";

export interface ServiceProblemReason {
  id: string;
  name: string;
  description?: string | null;
}

export interface ProblemReasonsResponse {
  reasons: ServiceProblemReason[];
}

export async function fetchProblemReasonsForWorker(): Promise<ProblemReasonsResponse> {
  const { data } = await axios.get<ProblemReasonsResponse>(
    `${API_URL}/service-problem-reason/worker/me`,
  );
  return data;
}
