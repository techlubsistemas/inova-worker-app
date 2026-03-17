import { API_URL } from "@/context/AuthContext";
import type { TutorialsResponse } from "@/types/tutorial";
import axios from "axios";

export async function fetchTutorials(): Promise<TutorialsResponse> {
  const { data } = await axios.get<TutorialsResponse>(
    `${API_URL}/tutorial/worker/me`
  );
  return data;
}
