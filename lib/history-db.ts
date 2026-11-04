import {
  HISTORY_DB_NAME,
  HISTORY_DB_VERSION,
  HISTORY_RETENTION_MS,
  HISTORY_STORE,
} from "./constants";
import type { HistoryEntry } from "./types";

const UPDATED_AT_INDEX = "updatedAt";

let dbPromise: Promise<IDBDatabase> | null = null;

function openHistoryDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(HISTORY_STORE, {
          keyPath: "id",
        });
        store.createIndex(UPDATED_AT_INDEX, "updatedAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    /* 失敗時は次回呼び出しで開き直せるようにする */
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** 1 トランザクションで操作し、コミット完了後に結果を返す */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openHistoryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, mode);
    const request = run(tx.objectStore(HISTORY_STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function pruneExpiredHistory(): Promise<unknown> {
  const range = IDBKeyRange.upperBound(Date.now() - HISTORY_RETENTION_MS);
  return withStore("readwrite", (store) => {
    const request = store.index(UPDATED_AT_INDEX).openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    return request;
  });
}

/** 履歴 1 件を追加または上書きする */
export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  await withStore("readwrite", (store) => store.put(entry));
}

/** 保持期間を過ぎた履歴を削除し、残りを開始日時の新しい順で返す */
export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  await pruneExpiredHistory();
  const entries = await withStore<HistoryEntry[]>("readonly", (store) =>
    store.getAll(),
  );
  return entries.sort((a, b) => b.startedAt - a.startedAt);
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
