"use client";

import { FormEvent, useState } from "react";
import { Barcode, Eye, EyeOff, LoaderCircle, LockKeyhole, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(payload.message || "Não foi possível entrar.");
        return;
      }

      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/";
      window.location.replace(destination);
    } catch {
      setMessage("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark">
            <Barcode size={25} strokeWidth={2.2} />
          </span>
          <span>Consultor</span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Acesso protegido</p>
          <h1 id="login-title">Entre para consultar</h1>
          <p>Seus dados e a atualização do Google Drive ficam disponíveis somente após o login.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>Usuário</span>
            <div className="login-field">
              <User size={19} />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
          </label>

          <label>
            <span>Senha</span>
            <div className="login-field">
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
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>

          {message && <div className="login-message" role="alert">{message}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={19} /> : <LockKeyhole size={19} />}
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="login-note">A sessão fica protegida neste dispositivo por 30 dias.</p>
      </section>
    </main>
  );
}
