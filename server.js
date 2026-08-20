import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const upload = multer({ dest: '/tmp/influencer-ai' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projects = new Map();
const port = Number(process.env.PORT || 10000);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, service: 'influencer-ai', version: '0.3.2', geminiConfigured: Boolean(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' }));
app.get('/api/influencers', (_req, res) => res.json([
  { id: 'maya', name: 'Maya', style: 'tech + fitness', voice: 'pt-BR' },
  { id: 'sofia', name: 'Sofia', style: 'lifestyle + beauty', voice: 'pt-BR' },
  { id: 'ana', name: 'Ana', style: 'business + UGC', voice: 'pt-BR' }
]));
app.post('/api/projects', (req, res) => { const id = crypto.randomUUID(); const project = { id, status: 'draft', createdAt: new Date().toISOString(), ...req.body }; projects.set(id, project); res.status(201).json(project); });
app.post('/api/projects/:id/assets', upload.array('assets', 20), (req, res) => { const p = projects.get(req.params.id); if (!p) return res.status(404).json({ error: 'Projeto não encontrado' }); p.assets = [...(p.assets || []), ...(req.files || []).map(f => ({ name: f.originalname, path: f.path, size: f.size }))]; res.json({ ok: true, assets: p.assets }); });

async function createScript(project) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no Render');
  const prompt = `Você é o AI Director de um SaaS de vídeos publicitários. Crie um plano vertical de ${project.duration || 30} segundos. Influencer: ${project.influencer}. Estilo: ${project.style}. Briefing: ${project.brief}. Retorne SOMENTE JSON válido com hook, script, scenes (array de {duration,visual,dialogue,productFocus}) e cta. Português brasileiro, natural, persuasivo e adequado para Reels/TikTok/Shorts.`;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }) });
  if (!response.ok) throw new Error(`Gemini retornou HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json(); const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''; if (!text) throw new Error('Gemini não retornou roteiro');
  try { return JSON.parse(text); } catch { return { hook: '', script: text, scenes: [], cta: '' }; }
}
app.post('/api/projects/:id/generate', async (req, res) => { const p = projects.get(req.params.id); if (!p) return res.status(404).json({ error: 'Projeto não encontrado' }); p.status = 'generating_script'; p.job = { id: crypto.randomUUID(), stage: 'ai_director', progress: 10 }; try { p.script = await createScript(p); p.status = 'script_ready'; p.job.stage = 'script_ready'; p.job.progress = 35; p.message = 'Roteiro real criado pelo Gemini. O MP4 ainda requer o provider de avatar/vídeo.'; res.status(202).json({ ok: true, projectId: p.id, job: p.job, script: p.script, message: p.message }); } catch (error) { p.status = 'failed'; p.job.error = error.message; res.status(502).json({ ok: false, projectId: p.id, error: error.message }); } });
app.get('/api/projects/:id', (req, res) => { const p = projects.get(req.params.id); if (!p) return res.status(404).json({ error: 'Projeto não encontrado' }); res.json(p); });
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Erro interno', message: err.message }); });

app.listen(port, '0.0.0.0', () => console.log(`Influencer AI listening on ${port}`));
