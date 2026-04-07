import type { FolderInfo, ImageMeta } from "@/types/image";

export type ReviewStatus = "unreviewed" | "reviewed" | "excluded";

export interface TaskImageResponse {
  id: number;
  task_id: number;
  image_id: number;
  folder_path: string;
  added_at: string;
  review_status: ReviewStatus;
  image: ImageMeta;
}

export interface TaskFolderContentsResponse {
  current_path: string;
  folders: FolderInfo[];
  images: TaskImageResponse[];
  total_images: number;
}
