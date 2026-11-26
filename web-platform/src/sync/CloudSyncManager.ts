import { LocalStore } from '@app/core/sync/LocalStore';
import { sanitizeImportedDocument } from '@app/core/security/Sanitizer';
import type { MindMapDocument } from '@app/types/mindmap';
import { WebApi } from '../api/webApiClient';

export interface CloudSyncResult {
  totalCloudMaps: number;
  pulledNewOrUpdated: number;
  syncedAt: number;
}

export async function runBidirectionalCloudSync(): Promise<CloudSyncResult> {
  const localAll = await LocalStore.listMaps();
  const activeLocal = localAll.filter((m) => !m.deletedAt);
  const trashedIds = localAll.filter((m) => Boolean(m.deletedAt)).map((m) => m.id);
  const tombstones = LocalStore.getDeletedMapTombstones();
  const activeIds = new Set(activeLocal.map((m) => m.id));
  const deletedIds = Array.from(new Set([...trashedIds, ...tombstones])).filter(
    (id) => !activeIds.has(id)
  );
  const deletedSet = new Set(deletedIds);
  const localById = new Map(activeLocal.map((m) => [m.id, m]));

  const res = await WebApi.syncCloudMaps(activeLocal.slice(0, 50), deletedIds.slice(0, 120));
  if (tombstones.length > 0) {
    LocalStore.clearDeletedMapTombstones(tombstones);
  }

  let pulledNewOrUpdated = 0;
  for (const rawRemote of res.maps || []) {
    const clean = sanitizeImportedDocument(rawRemote);
    if (!clean || deletedSet.has(clean.id)) continue;
    const localExisting = localById.get(clean.id);
    if (!localExisting || (clean.updatedAt || 0) > (localExisting.updatedAt || 0) + 500) {
      await LocalStore.saveMap(clean, { preserveUpdatedAt: true });
      pulledNewOrUpdated += 1;
    }
  }

  return {
    totalCloudMaps: res.totalCloudMaps,
    pulledNewOrUpdated,
    syncedAt: res.syncedAt,
  };
}

export async function cloneSharedMapToLocalWorkspace(doc: MindMapDocument): Promise<MindMapDocument> {
  const clean = sanitizeImportedDocument(doc);
  if (!clean) {
    throw new Error('Paylaşılan harita doğrulanamadı.');
  }
  const cloned: MindMapDocument = {
    ...clean,
    id: `shared_copy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: `${clean.title} (Kopya)`,
    updatedAt: Date.now(),
    deletedAt: null,
  };
  await LocalStore.saveMap(cloned, { forceSnapshot: true });
  return cloned;
}
