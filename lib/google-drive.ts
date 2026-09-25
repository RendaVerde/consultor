import { createSign } from "node:crypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const SOURCE_FILES = [
  "produtos.xlsx",
  "aruba.xlsx",
  "maggiore.xlsx",
  "oggi.xlsx",
  "paradise.xlsx",
  "mares.xlsx",
  "varandas.xlsx",
  "miami.xlsx",
  "cd.xlsx",
] as const;

export type DriveSourceFile = {
  id: string;
  name: (typeof SOURCE_FILES)[number];
  modifiedTime: string | null;
  size: string | null;
};

type ServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

let tokenCache: { value: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function serviceAccount(): ServiceAccount {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (rawJson) {
    let parsed: { client_email?: unknown; private_key?: unknown };
    try {
      parsed = JSON.parse(rawJson) as typeof parsed;
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não contém um JSON válido.");
    }

    if (
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON não contém client_email e private_key.",
      );
    }

    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("As credenciais da conta de serviço do Google não foram configuradas.");
  }
  return { clientEmail, privateKey };
}

export function driveConfigurationErrors() {
  const errors: string[] = [];
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()) {
    errors.push("GOOGLE_DRIVE_FOLDER_ID");
  }
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() &&
    (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
      !process.env.GOOGLE_PRIVATE_KEY?.trim())
  ) {
    errors.push("credenciais do Google");
  }
  return errors;
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(account.privateKey))}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: unknown;
    expires_in?: unknown;
    error_description?: unknown;
  };

  if (!response.ok || typeof payload.access_token !== "string") {
    const detail =
      typeof payload.error_description === "string"
        ? ` ${payload.error_description}`
        : "";
    throw new Error(`O Google recusou a autenticação da conta de serviço.${detail}`);
  }

  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return tokenCache.value;
}

async function driveFetch(url: string) {
  const token = await accessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `O Google Drive respondeu com ${response.status}.${detail ? ` ${detail.slice(0, 300)}` : ""}`,
    );
  }
  return response;
}

export async function findSourceFiles(): Promise<DriveSourceFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID não foi configurado.");

  const found: Array<{
    id?: unknown;
    name?: unknown;
    mimeType?: unknown;
    modifiedTime?: unknown;
    size?: unknown;
  }> = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
    );
    const payload = (await response.json()) as {
      files?: typeof found;
      nextPageToken?: unknown;
    };
    found.push(...(payload.files ?? []));
    pageToken =
      typeof payload.nextPageToken === "string" ? payload.nextPageToken : "";
  } while (pageToken);

  return SOURCE_FILES.map((expectedName) => {
    const matches = found.filter(
      (file) => file.name === expectedName && file.mimeType === XLSX_MIME,
    );
    if (matches.length === 0) {
      throw new Error(`O arquivo ${expectedName} não foi encontrado na pasta do Drive.`);
    }
    if (matches.length > 1) {
      throw new Error(
        `Há mais de um arquivo chamado ${expectedName} na pasta do Drive. Mantenha apenas a versão correta.`,
      );
    }
    const file = matches[0];
    if (typeof file.id !== "string") {
      throw new Error(`O Google não retornou o ID de ${expectedName}.`);
    }
    return {
      id: file.id,
      name: expectedName,
      modifiedTime:
        typeof file.modifiedTime === "string" ? file.modifiedTime : null,
      size: typeof file.size === "string" ? file.size : null,
    };
  });
}

export async function downloadDriveFile(fileId: string) {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
  );
  return Buffer.from(await response.arrayBuffer());
}

