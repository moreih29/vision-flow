export interface ImageMeta {
  id: number;
  original_filename: string;
  file_size: number;
  width: number | null;
  height: number | null;
  mime_type: string;
  data_store_id: number;
  uploaded_by: number;
  created_at: string;
}

export interface FolderInfo {
  path: string;
  name: string;
  image_count: number;
  subfolder_count: number;
}

export interface FolderContentsResponse {
  current_path: string;
  folders: FolderInfo[];
  images: ImageMeta[];
  total_images: number;
}

export interface DataPoolItem {
  type: "folder" | "image" | "parent";
  key: string;
  folder?: FolderInfo;
  image?: ImageMeta;
}
