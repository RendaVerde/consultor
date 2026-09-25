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

- `GOOGLE_DRIVE_FOLDER_ID`: pasta que contém `produtos.xlsx` e os oito planogramas.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo da conta de serviço com acesso de leitura à pasta.
- `BLOB_READ_WRITE_TOKEN`: criado ao conectar um Vercel Blob privado ao projeto.
- `IHM_SYNC_TOKEN`: senha escolhida para proteger a atualização manual.

### Preparar a conexão com o Google Drive

1. Crie ou selecione um projeto no Google Cloud e habilite a **Google Drive API**.
2. Crie uma conta de serviço e uma chave JSON.
3. Compartilhe a pasta do Drive com o e-mail `client_email` da conta de serviço como **Leitor**.
4. Na Vercel, crie um armazenamento **Blob privado** na aba Storage. A variável `BLOB_READ_WRITE_TOKEN` será adicionada ao projeto.
5. Cadastre `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` e uma senha forte em `IHM_SYNC_TOKEN` para Production, Preview e Development.
6. Faça um novo deploy e use **Base de dados > Atualizar dados agora**. Na primeira tentativa, o Consultor pedirá a chave de atualização.

O navegador consulta somente a cópia JSON privada. Os nove arquivos do Drive são baixados apenas durante a atualização manual. Se qualquer arquivo estiver ausente, duplicado ou com colunas incompatíveis, a base anterior é preservada.

Para testar localmente, copie as mesmas variáveis para `.env.local`. Nunca envie o JSON da conta de serviço ou `.env.local` ao Git.

O domínio próprio e o certificado HTTPS são configurados no painel da Vercel.

## Runtime alternativo da Cloudflare

A configuração anterior foi preservada como alternativa:

```bash
pnpm dev:cloudflare
pnpm build:cloudflare
pnpm preview:cloudflare
```

Esses comandos não são utilizados pela Vercel.
