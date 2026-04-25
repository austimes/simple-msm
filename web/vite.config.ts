import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getConfigurationDocumentId } from './src/data/configurationMetadata.ts';

const configDirname = path.dirname(fileURLToPath(import.meta.url));

function slugifyConfigurationName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
  );
}

function getUserConfigurationId(config: unknown): string | null {
  if (!config || typeof config !== 'object') {
    return null;
  }

  const metadataId = getConfigurationDocumentId(config);
  if (metadataId) {
    return metadataId;
  }

  const name = (
    'name' in config
    && typeof config.name === 'string'
      ? slugifyConfigurationName(config.name)
      : ''
  );

  return name || null;
}

function isCanonicalUserConfigFile(filename: string, configId: string | null): boolean {
  return !!configId && filename.toLowerCase() === `${configId.toLowerCase()}.json`;
}

function readUserConfigurations(configDir: string): unknown[] {
  fs.mkdirSync(configDir, { recursive: true });

  const deduped = new Map<string, { filename: string; config: unknown }>();
  const files = fs.readdirSync(configDir).filter((file) => file.endsWith('.json'));

  for (const filename of files) {
    const raw = fs.readFileSync(path.join(configDir, filename), 'utf-8');
    const config = JSON.parse(raw) as unknown;
    const configId = getUserConfigurationId(config);
    const key = configId ? `id:${configId}` : `file:${filename}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, { filename, config });
      continue;
    }

    const candidateIsCanonical = isCanonicalUserConfigFile(filename, configId);
    const existingIsCanonical = isCanonicalUserConfigFile(existing.filename, configId);

    if (candidateIsCanonical && !existingIsCanonical) {
      deduped.set(key, { filename, config });
    }
  }

  return Array.from(deduped.values()).map((entry) => entry.config);
}

function removeDuplicateUserConfigurationFiles(configDir: string, configId: string, keepFilename: string): void {
  const files = fs.readdirSync(configDir).filter((file) => file.endsWith('.json'));

  for (const filename of files) {
    if (filename === keepFilename) {
      continue;
    }

    const filepath = path.join(configDir, filename);

    try {
      const raw = fs.readFileSync(filepath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;

      if (getUserConfigurationId(parsed) === configId) {
        fs.unlinkSync(filepath);
      }
    } catch {
      // Ignore malformed files here. The GET handler remains best-effort.
    }
  }
}

function userConfigApi(): Plugin {
  const configDir = path.resolve(configDirname, 'src/configurations/user');

  return {
    name: 'user-config-api',
    configureServer(server) {
      server.middlewares.use('/api/user-configurations', (req, res) => {
        if (req.method === 'GET') {
          try {
            const configs = readUserConfigurations(configDir);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(configs));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        if (req.method === 'PUT') {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const config = JSON.parse(body) as unknown;
              const configId = getUserConfigurationId(config);

              if (!configId) {
                throw new Error('Configuration id is required in app_metadata.id or top-level id.');
              }

              const filename = `${configId}.json`;
              fs.mkdirSync(configDir, { recursive: true });
              fs.writeFileSync(
                path.join(configDir, filename),
                JSON.stringify(config, null, 2) + '\n',
              );
              removeDuplicateUserConfigurationFiles(configDir, configId, filename);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }

        if (req.method === 'DELETE') {
          const url = new URL(req.url ?? '', `http://${req.headers.host}`);
          const id = url.searchParams.get('id');
          if (!id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing id parameter' }));
            return;
          }
          fs.mkdirSync(configDir, { recursive: true });
          removeDuplicateUserConfigurationFiles(configDir, id, '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(405);
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), userConfigApi()],
  resolve: {
    alias: {
      '@': path.resolve(configDirname, 'src'),
      '@root': path.resolve(configDirname, '..'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) {
            return 'vendor-react-dom';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/react-smooth')) {
            return 'vendor-recharts';
          }
          if (id.includes('node_modules/ajv')) {
            return 'vendor-ajv';
          }
        },
      },
    },
  },
  server: {
    fs: {
      allow: [path.resolve(configDirname, '..')],
    },
  },
});
