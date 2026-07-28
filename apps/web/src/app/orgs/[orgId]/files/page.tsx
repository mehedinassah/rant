'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  files as filesApi,
  uploadFile,
  downloadFile,
  formatBytes,
  type FileObject,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function iconFor(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎞️';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return '🗜️';
  if (mime.startsWith('text/') || mime.includes('json')) return '📄';
  return '📎';
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function FilesPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [items, setItems] = useState<FileObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setItems(await filesApi.list(orgId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        for (const f of Array.from(fileList)) await uploadFile(orgId, f);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [orgId, load],
  );

  async function remove(id: string) {
    await filesApi.remove(orgId, id).catch(() => undefined);
    await load();
  }

  async function download(f: FileObject) {
    try {
      await downloadFile(orgId, f.id, f.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Files</h1>
      <p className="text-sm text-white/40">Upload and share files (up to 5 MB each).</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-white/15 hover:border-white/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <p className="text-sm text-white/60">
          {uploading ? 'Uploading…' : 'Drag files here, or click to browse'}
        </p>
      </div>

      {/* List */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          {items.length} file{items.length === 1 ? '' : 's'}
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">No files yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            {items.map((f, i) => (
              <div
                key={f.id}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-white/10' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-xl">{iconFor(f.mimeType)}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-white/40">
                      {formatBytes(f.sizeBytes)} · {f.uploader?.name ?? 'someone'} · {timeAgo(f.createdAt)}
                      {f.targetType && (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                          {f.targetType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => download(f)}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => remove(f.id)}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
