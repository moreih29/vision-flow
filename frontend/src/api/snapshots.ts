import client from "@/api/client";
import type {
  Snapshot,
  SnapshotCreate,
  SnapshotDiff,
  SnapshotItemListResponse,
  SnapshotRestoreDryRun,
  VersionStatus,
} from "@/types/snapshot";

export const snapshotsApi = {
  create: (taskId: number, data: SnapshotCreate) =>
    client.post<Snapshot>(`/tasks/${taskId}/snapshots`, data),

  list: (taskId: number) =>
    client.get<Snapshot[]>(`/tasks/${taskId}/snapshots`),

  get: (id: number) => client.get<Snapshot>(`/snapshots/${id}`),

  getItems: (
    id: number,
    params?: { path?: string; skip?: number; limit?: number },
  ) =>
    client.get<SnapshotItemListResponse>(`/snapshots/${id}/items`, { params }),

  diff: (idA: number, idB: number) =>
    client.get<SnapshotDiff>(`/snapshots/${idA}/diff/${idB}`),

  restore: (id: number, confirm: boolean) =>
    client.post<Snapshot | SnapshotRestoreDryRun>(`/snapshots/${id}/restore`, {
      confirm,
    }),

  delete: (id: number) => client.delete(`/snapshots/${id}`),

  getVersionStatus: (taskId: number) =>
    client.get<VersionStatus>(`/tasks/${taskId}/version-status`),

  getStash: (taskId: number) =>
    client.get<Snapshot | null>(`/tasks/${taskId}/stash`),

  createStash: (taskId: number) =>
    client.post<Snapshot>(`/tasks/${taskId}/stash`),

  deleteStash: (taskId: number) => client.delete(`/tasks/${taskId}/stash`),
};
