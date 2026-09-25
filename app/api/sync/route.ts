export const runtime = "edge";

export async function POST() {
  const endpoint = process.env.IHM_SYNC_ENDPOINT;
  const token = process.env.IHM_SYNC_TOKEN;

  if (!endpoint) {
    return Response.json(
      {
        status: "configuration_required",
        message:
          "A conexão automática com o Google Drive ainda não foi autorizada. O Consultor continua usando a última base validada.",
      },
      { status: 409 },
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return Response.json(
        {
          status: "failed",
          message:
            payload.message ??
            "O Drive respondeu com erro. A base anterior foi preservada.",
        },
        { status: 502 },
      );
    }

    return Response.json({ status: "ok", ...payload });
  } catch {
    return Response.json(
      {
        status: "failed",
        message:
          "Não foi possível alcançar o Drive. A base anterior foi preservada.",
      },
      { status: 503 },
    );
  }
}
