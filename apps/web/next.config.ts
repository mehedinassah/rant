import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Standalone output is only needed for the containerized (Linux) runtime image.
// It's gated behind NEXT_OUTPUT=standalone (set in the Docker build) because the
// file-tracing copy step trips over pnpm's symlinked store on Windows hosts.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(standalone
    ? { output: 'standalone', outputFileTracingRoot: path.join(dirname, '../../') }
    : {}),
};

export default nextConfig;
