import { useCallback, useState } from "react";
import { fetchTutorials } from "@/services/tutorial";
import type { Tutorial } from "@/types/tutorial";

export function useTutorials() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTutorials();
      setTutorials(res.tutorials ?? []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Falha ao carregar tutoriais.";
      setError(message);
      setTutorials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { tutorials, loading, error, refetch };
}
