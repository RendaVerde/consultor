"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  browserSupportsPasskeys,
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
  Barcode,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import styles from "./login.module.css";

function destinationAfterLogin() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    browserSupportsPasskeys()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false));
  }, []);

  async function loginWithPasskey() {
    setPasskeyLoading(true);
    setMessage("");

    try {
      const optionsResponse = await fetch(
        "/api/auth/passkey/authenticate/options",
        { method: "POST" },
      );
      const optionsJSON = (await optionsResponse.json()) as
        | PublicKeyCredentialRequestOptionsJSON
        | { message?: string };

      if (!optionsResponse.ok) {
        throw new Error(
          ("message" in optionsJSON ? optionsJSON.message : undefined) ||
            "Não foi possível iniciar o acesso biométrico.",
        );
      }

      const credential = await startAuthentication({
        optionsJSON: optionsJSON as PublicKeyCredentialRequestOptionsJSON,
      });
      const verificationResponse = await fetch(
        "/api/auth/passkey/authenticate/verify",
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
          verification.message || "Não foi possível confirmar sua identidade.",
        );
      }

      window.location.replace(destinationAfterLogin());
    } catch (error) {
      const cancelled =
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "AbortError");
      setMessage(
        cancelled
          ? "Acesso cancelado. Você pode tentar novamente ou usar sua senha."
          : error instanceof Error
            ? error.message
            : "Não foi possível entrar com biometria.",
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Usuário ou senha incorretos.");
      }

      window.location.replace(destinationAfterLogin());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <aside className={styles.brandPanel}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              <Barcode size={24} strokeWidth={2.4} />
            </span>
            <span>Consultor</span>
          </div>

          <div className={styles.brandContent}>
            <span className={styles.protectedPill}>
              <ShieldCheck size={16} />
              Acesso protegido
            </span>
            <h1>Decisões de compra mais rápidas, direto no estoque.</h1>
            <p>
              Consulte produtos, preços e disponibilidade dos mercados em uma
              única tela.
            </p>

            <ul className={styles.benefits}>
              <li>
                <Check size={16} />
                Base integrada ao Google Drive
              </li>
              <li>
                <Check size={16} />
                Acesso rápido por código de barras
              </li>
              <li>
                <Check size={16} />
                Informações protegidas por sessão segura
              </li>
            </ul>
          </div>

          <div className={styles.brandFooter}>
            <Sparkles size={15} />
            Feito para funcionar bem no celular e no computador
          </div>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.mobileBrand}>
            <span className={styles.brandMark} aria-hidden="true">
              <Barcode size={22} strokeWidth={2.4} />
            </span>
            <span>Consultor</span>
          </div>

          <div className={styles.formHeading}>
            <span>Bem-vindo de volta</span>
            <h2>Entre para consultar</h2>
            <p>Use a biometria cadastrada ou sua senha de acesso.</p>
          </div>

          {passkeySupported && (
            <button
              className={styles.passkeyButton}
              type="button"
              onClick={loginWithPasskey}
              disabled={passkeyLoading || loading}
            >
              <span className={styles.passkeyIcon}>
                {passkeyLoading ? (
                  <LoaderCircle className={styles.spin} size={23} />
                ) : (
                  <Fingerprint size={24} />
                )}
              </span>
              <span>
                <strong>
                  {passkeyLoading ? "Aguardando confirmação…" : "Entrar com biometria"}
                </strong>
                <small>Digital, reconhecimento facial ou PIN seguro</small>
              </span>
            </button>
          )}

          {passkeySupported && (
            <div className={styles.divider}>
              <span>ou use sua senha</span>
            </div>
          )}

          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span>Usuário</span>
              <div className={styles.inputWrap}>
                <User size={19} />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username webauthn"
                  inputMode="text"
                  required
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>Senha</span>
              <div className={styles.inputWrap}>
                <LockKeyhole size={19} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  autoFocus
                />
                <button
                  className={styles.passwordToggle}
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>

            {message && (
              <div className={styles.message} role="alert">
                {message}
              </div>
            )}

            <button
              className={styles.submit}
              type="submit"
              disabled={loading || passkeyLoading}
            >
              {loading ? <LoaderCircle className={styles.spin} size={19} /> : null}
              {loading ? "Entrando…" : "Entrar com senha"}
            </button>
          </form>

          <p className={styles.sessionNote}>
            <ShieldCheck size={16} />
            Sua sessão fica protegida neste dispositivo por até 30 dias.
          </p>
        </div>
      </section>
    </main>
  );
}
