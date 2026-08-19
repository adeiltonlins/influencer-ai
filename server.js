import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const upload = multer({ dest: '/tmp/influencer-ai' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const projects = new Map();

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'influencer-ai', version: '0.1.0' }));

app.get('/api/influencers', (_req, res) => res.json([
  { id: 'maya', name: 'Maya', style: 'tech + fitness', voice: 'pt-BR', description: 'Apresentadora brasileira, confiante e natural.' },
  { id: 'sofia', name: 'Sofia', style: 'lifestyle + beauty', voice: 'pt-BR', description: 'Influencer brasileira, elegante e espontânea.' },
  { id: 'ana', name: 'Ana', style: 'business + UGC', voice: 'pt-BR', description: 'Apresentadora direta, profissional e persuasiva.' }
]));

app.post('/api/projects', (req, res) => {
  const id = crypto.randomUUID();
  const project = { id, status: 'draft', createdAt: new Date().toISOString(), ...req.body };
  projects.set(id, project);
  res.status(201).json(project);
});

app.post('/api/projects/:id/assets', upload.array('assets', 20), (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
  project.assets = [...(project.assets || []), ...(req.files || []).map(f => ({ name: f.originalname, path: f.path, size: f.size }))];
  res.json({ ok: true, assets: project.assets });
});

app.post('/api/projects/:id/generate', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
  project.status = 'queued';
  project.job = { id: crypto.randomUUID(), stage: 'ai_director', progress: 5 };
  res.status(202).json({ ok: true, projectId: project.id, job: project.job, message: 'Vídeo colocado na fila. O provider de avatar/voz será conectado na próxima etapa.' });
});

app.get('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json(project);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno', message: err.message });
});

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => console.log(`Influencer AI listening on ${port}`));
