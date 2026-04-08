import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function userConfigApi(): Plugin {
  const configDir = path.resolve(__dirname, 'public/configurations/user');

  return {
    name: 'user-config-api',
    configureServer(server) {
      server.middlewares.use('/api/user-configurations', (req, res) => {
        if (req.method === 'GET') {
          const files = fs.readdirSync(configDir).filter((f) => f.endsWith('.json'));
          const configs = files.map((f) => {
            const raw = fs.readFileSync(path.join(configDir, f), 'utf-8');
            return JSON.parse(raw);
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(configs));
          return;
        }

        if (req.method === 'PUT') {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const config = JSON.parse(body);
              const filename = `${config.id}.json`;
              fs.mkdirSync(configDir, { recursive: true });
              fs.writeFileSync(
                path.join(configDir, filename),
                JSON.stringify(config, null, 2) + '\n',
              );
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
          const filepath = path.join(configDir, `${id}.json`);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
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
      '@': path.resolve(__dirname, 'src'),
      '@root': path.resolve(__dirname, '..'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
