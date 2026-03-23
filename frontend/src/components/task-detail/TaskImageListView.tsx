import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imagesApi } from "@/api/images";
import type { ImageMeta } from "@/types/image";

interface TaskImageListViewProps {
  images: ImageMeta[];
  onRemove: (id: number) => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskImageListView({
  images,
  onRemove,
}: TaskImageListViewProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium w-12"></th>
            <th className="px-3 py-2 text-left font-medium">파일명</th>
            <th className="px-3 py-2 text-left font-medium w-24">크기</th>
            <th className="px-3 py-2 text-left font-medium w-28">해상도</th>
            <th className="px-3 py-2 text-center font-medium w-20">라벨</th>
            <th className="px-3 py-2 text-right font-medium w-16"></th>
          </tr>
        </thead>
        <tbody>
          {images.map((image) => (
            <tr
              key={image.id}
              className="border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-1.5">
                <img
                  src={imagesApi.getFileUrl(image.id)}
                  alt={image.original_filename}
                  className="h-10 w-10 rounded object-cover"
                  loading="lazy"
                />
              </td>
              <td className="px-3 py-1.5">
                <span
                  className="truncate block max-w-xs select-text"
                  title={image.original_filename}
                >
                  {image.original_filename}
                </span>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {formatBytes(image.file_size)}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {image.width && image.height
                  ? `${image.width} x ${image.height}`
                  : "-"}
              </td>
              <td className="px-3 py-1.5 text-center text-muted-foreground">
                0
              </td>
              <td className="px-3 py-1.5 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(image.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
