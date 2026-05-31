import { API_URL } from "@/context/AuthContext";
import axios from "axios";

/** Registra a coleta de uma amostra de óleo no campo (worker-app). */
export async function collectOilSample(input: {
  equipmentId: string;
  sampleCode?: string;
  notes?: string;
}): Promise<void> {
  await axios.post(`${API_URL}/oil-sample/worker`, input, { timeout: 30_000 });
}
