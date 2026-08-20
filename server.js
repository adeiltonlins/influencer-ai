import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const upload = multer({ dest: '/tmp/influencer-ai' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projects = new Map();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'influencer-ai', version: '0.2.0', openaiConfigured: Boolean(process.env.OPENAI_API_KEY) }));
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

async function createScript(project) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada no Render');
  const prompt = `Você é o AI Director de um SaaS de vídeos publicitários. Crie um plano de vídeo vertical para ${project.duration || 30} segundos. Influencer: ${project.influencer}. Estilo: ${project.style}. Briefing: ${project.brief}. Retorne SOMENTE JSON válido com: hook, script, scenes (array de {duration, visual, dialogue, productFocus}), cta. O texto deve estar em português brasileiro e ser natural, comercial e adequado para redes sociais.`;
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini', input: prompt }) });
  if (!response.ok) throw new Error(`OpenAI retornou HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || '').join('') || '';
  if (!text) throw new Error('OpenAI não retornou roteiro');
  try { return JSON.parse(text); } catch { return { hook: '', script: text, scenes: [], cta: '' }; }
}

app.post('/api/projects/:id/generate', async (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
  project.status = 'generating_script';
  project.job = { id: crypto.randomUUID(), stage: 'ai_director', progress: 10 };
  try {
    project.script = await createScript(project);
    project.status = 'script_ready';
    project.job.stage = 'script_ready';
    project.job.progress = 35;
    project.message = 'Roteiro real criado pela IA. A geração do avatar/vídeo depende de um provider de vídeo configurado.';
    res.status(202).json({ ok: true, projectId: project.id, job: project.job, script: project.script, message: project.message });
  } catch (error) {
    project.status = 'failed';
    project.job.error = error.message;
    res.status(502).json({ ok: false, projectId: project.id, error: error.message });
  }
});

app.get('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json(project);
});
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Erro interno', message: err.message }); });
const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => console.log(`Influencer AI listening on ${port}`));
