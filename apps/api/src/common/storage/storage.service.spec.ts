import { StorageService } from './storage.service';
import { DbStorageProvider } from './providers/db.storage';

const cfg = (values: Record<string, string> = {}) =>
  ({ get: (k: string, d?: string) => values[k] ?? d ?? '' }) as never;

describe('StorageService provider selection', () => {
  it('defaults to the db provider', () => {
    expect(new StorageService(cfg(), {} as never).name).toBe('db');
  });

  it('selects s3 when a bucket is configured', () => {
    expect(new StorageService(cfg({ S3_BUCKET: 'my-bucket' }), {} as never).name).toBe('s3');
  });

  it('honors explicit STORAGE_PROVIDER=db even with a bucket', () => {
    expect(new StorageService(cfg({ STORAGE_PROVIDER: 'db', S3_BUCKET: 'b' }), {} as never).name).toBe('db');
  });
});

describe('DbStorageProvider', () => {
  it('upserts bytes on put and reads them back on get', async () => {
    const store = new Map<string, Buffer>();
    const prisma = {
      storageBlob: {
        upsert: jest.fn(async ({ where, create }) => store.set(where.key, Buffer.from(create.content))),
        findUnique: jest.fn(async ({ where }) =>
          store.has(where.key) ? { content: store.get(where.key) } : null,
        ),
        deleteMany: jest.fn(async ({ where }) => store.delete(where.key)),
      },
    };
    const p = new DbStorageProvider(prisma as never);

    await p.put('files/a', Buffer.from('hello'), 'text/plain');
    const got = await p.get('files/a');
    expect(got?.toString()).toBe('hello');

    expect(await p.signedUrl()).toBeNull();

    await p.remove('files/a');
    expect(await p.get('files/a')).toBeNull();
  });
});
