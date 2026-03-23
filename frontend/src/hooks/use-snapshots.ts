import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { snapshotsApi } from "@/api/snapshots";
import type { SnapshotCreate } from "@/types/snapshot";

export function useSnapshots(taskId: number) {
  return useQuery({
    queryKey: ["snapshots", taskId],
    queryFn: async () => {
      const res = await snapshotsApi.list(taskId);
      return res.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateSnapshot(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SnapshotCreate) =>
      snapshotsApi.create(taskId, data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots", taskId] });
    },
  });
}

export function useRestoreSnapshot(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirm }: { id: number; confirm: boolean }) =>
      snapshotsApi.restore(id, confirm).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots", taskId] });
      qc.invalidateQueries({ queryKey: ["stash", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks", taskId, "version-status"] });
      qc.invalidateQueries({ queryKey: ["tasks", taskId] });
      qc.invalidateQueries({ queryKey: ["task-images", taskId] });
      qc.invalidateQueries({ queryKey: ["task-folder", taskId] });
    },
  });
}

export function useDeleteSnapshot(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: number) => snapshotsApi.delete(snapshotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots", taskId] });
    },
  });
}

export function useVersionStatus(taskId: number) {
  return useQuery({
    queryKey: ["tasks", taskId, "version-status"],
    queryFn: () =>
      snapshotsApi.getVersionStatus(taskId).then((res) => res.data),
    refetchInterval: 10_000,
  });
}

export function useStash(taskId: number) {
  return useQuery({
    queryKey: ["stash", taskId],
    queryFn: () => snapshotsApi.getStash(taskId).then((res) => res.data),
    enabled: !!taskId,
  });
}

export function useCreateStash(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => snapshotsApi.createStash(taskId).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stash", taskId] });
    },
  });
}

export function useDeleteStash(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => snapshotsApi.deleteStash(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stash", taskId] });
    },
  });
}

export function useSnapshotDiff(idA: number | null, idB: number | null) {
  return useQuery({
    queryKey: ["snapshot-diff", idA, idB],
    queryFn: async () => {
      const res = await snapshotsApi.diff(idA!, idB!);
      return res.data;
    },
    enabled: !!idA && !!idB && idA !== idB,
  });
}
