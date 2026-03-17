export type TutorialType = "video" | "file";

export interface Tutorial {
  id: string;
  name: string;
  description: string | null;
  type: TutorialType;
  videoUrl: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export interface TutorialsResponse {
  tutorials: Tutorial[];
}
