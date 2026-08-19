# Influencer AI

SaaS para transformar fotos de produtos + uma influencer virtual + um briefing em vídeos publicitários.

## MVP
- Projetos de vídeo
- Upload de assets
- Biblioteca de influencers
- Briefing com AI Director
- Plano de cenas
- Pipeline assíncrono de geração
- Providers configuráveis para voz/avatar/vídeo
- Composição com FFmpeg
- Preview e histórico

## Arquitetura
Frontend → API → Job Queue → AI Director → Scene Engine → Voice/Avatar Provider → Composer/FFmpeg → Storage → Preview.

A geração pesada deve ocorrer em workers, nunca bloqueando a requisição HTTP.

## Status
MVP inicial em construção.
