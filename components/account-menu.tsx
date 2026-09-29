"use client";

import { useEffect, useState } from "react";
import {
  browserSupportsPasskeys,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
import {
  CheckCircle2,
  Fingerprint,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PasskeyStatus = {
  configured: boolean;
  passkeyCount: number;
};

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<PasskeyStatus | null>(null);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    browserSupportsPasskeys().then(setSupported).catch(() => setSupported(false));
    fetch("/api/auth/passkey/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("status");
        return (await response.json()) as PasskeyStatus;
      })
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function registerPasskey() {
    setRegistering(true);
    setMessage("");
    try {
      const optionsResponse = await fetch(
        "/api/auth/passkey/register/options",
        { method: "POST" },
      );
      const optionsJSON = (await optionsResponse.json()) as
        | PublicKeyCredentialCreationOptionsJSON
        | { message?: string };
      if (!optionsResponse.ok) {
        throw new Error(
          ("message" in optionsJSON ? optionsJSON.message : undefined) ||
            "Não foi possível iniciar o cadastro.",
        );
      }

      const credential = await startRegistration({
        optionsJSON: optionsJSON as PublicKeyCredentialCreationOptionsJSON,
      });
      const verificationResponse = await fetch(
        "/api/auth/passkey/register/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential),
        },
      );
      const verification = (await verificationResponse.json()) as {
        message?: string;
      };
      if (!verificationResponse.ok) {
        throw new Error(
          verification.message || "Não foi possível concluir o cadastro.",
        );
      }

      setStatus((current) => ({
        configured: true,
        passkeyCount: (current?.passkeyCount ?? 0) + 1,
      }));
      setMessage(verification.message || "Biometria cadastrada com sucesso.");
    } catch (error) {
      const cancelled =
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "AbortError");
      setMessage(
        cancelled
          ? "Cadastro cancelado. Você pode tentar novamente quando quiser."
          : error instanceof Error
            ? error.message
            : "Não foi possível cadastrar a biometria.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    window.location.replace("/login");
  }

  const needsPasskey = supported && status?.configured && status.passkeyCount === 0;

  return (
    <>
      <button
        className={`account-trigger ${needsPasskey ? "needs-passkey" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={needsPasskey ? "Ativar biometria" : "Abrir conta"}
      >
        {needsPasskey ? <Fingerprint size={20} /> : <UserRound size={20} />}
        <span>{needsPasskey ? "Ativar biometria" : "Conta"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="account-dialog">
          <DialogHeader>
            <div className="account-dialog-icon">
              <ShieldCheck size={23} />
            </div>
            <DialogTitle>Segurança da conta</DialogTitle>
            <DialogDescription>
              Use a digital, o reconhecimento facial ou o bloqueio do aparelho
              para entrar sem digitar sua senha.
            </DialogDescription>
          </DialogHeader>

          <div className="passkey-status">
            <span className={status?.passkeyCount ? "active" : ""}>
              {status?.passkeyCount ? (
                <CheckCircle2 size={19} />
              ) : (
                <Fingerprint size={19} />
              )}
            </span>
            <div>
              <strong>
                {status?.passkeyCount
                  ? "Acesso biométrico ativo"
                  : "Acesso biométrico não cadastrado"}
              </strong>
              <small>
                {status?.passkeyCount
                  ? `${status.passkeyCount} dispositivo${status.passkeyCount > 1 ? "s" : ""} cadastrado${status.passkeyCount > 1 ? "s" : ""}`
                  : "Cadastre este aparelho para entrar mais rápido."}
              </small>
            </div>
          </div>

          {message && (
            <div className="account-message" role="status">
              {message}
            </div>
          )}

          {supported ? (
            <Button
              className="passkey-register-button"
              onClick={registerPasskey}
              disabled={registering || status?.configured === false}
            >
              {registering ? (
                <LoaderCircle className="spin" size={19} />
              ) : (
                <Fingerprint size={19} />
              )}
              {registering
                ? "Aguardando o aparelho…"
                : status?.passkeyCount
                  ? "Cadastrar outro aparelho"
                  : "Cadastrar digital neste aparelho"}
            </Button>
          ) : (
            <p className="passkey-unavailable">
              Este navegador não oferece acesso por biometria. Você ainda pode
              usar sua senha normalmente.
            </p>
          )}

          <button className="account-logout" onClick={logout}>
            <LogOut size={18} />
            Sair do Consultor
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
