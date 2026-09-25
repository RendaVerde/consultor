# Consultor

Aplicação web mobile-first para consultar produtos da IHM por nome, ID ou código de barras e comparar custo, estoque, preço, margem e situação por mercado.

## Desenvolvimento

Requisitos: Node.js 22 e pnpm.

```bash
pnpm install
pnpm dev
```

Acesse `http://localhost:3000`.

## Validação de produção

```bash
pnpm typecheck
pnpm build
pnpm start
```

## Publicação na Vercel

O projeto usa Next.js nativo como runtime principal. Importe o repositório na Vercel, mantenha o preset **Next.js** e cadastre as variáveis de `.env.example` em **Project Settings > Environment Variables**.

- `IHM_SYNC_ENDPOINT`: endpoint protegido responsável por importar a base do Google Drive.
- `IHM_SYNC_TOKEN`: token enviado somente pelo servidor ao endpoint de sincronização.

O domínio próprio e o certificado HTTPS são configurados no painel da Vercel.

## Runtime alternativo da Cloudflare

A configuração anterior foi preservada como alternativa:

```bash
pnpm dev:cloudflare
pnpm build:cloudflare
pnpm preview:cloudflare
```

Esses comandos não são utilizados pela Vercel.
