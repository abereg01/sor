import React, { useMemo, useState } from "react";

type Props = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onLogin: (username: string, password: string) => void;
};

export function LoginModal({ open, busy = false, error, onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.length > 0 && !busy,
    [username, password, busy]
  );

  if (!open) return null;

  return (
    <div className="login-root" style={{ background: "var(--bg-0)" }}>
      <div className="hidden lg:block login-image">
        <img src="/loginsplash.jpg" alt="Login background" className="h-full w-full object-cover" />
      </div>

      <div className="login-form-pane context-panel">
        <div className="login-form-inner">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--panel-text)" }}>System of Record</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--panel-text-2)", marginTop: 2 }}>Karlshamn Energi</div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              onLogin(username.trim(), password);
            }}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <label htmlFor="username" className="ui-label">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                disabled={busy}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="ui-input"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="password" className="ui-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="off"
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-input"
              />
            </div>

            {error ? <div className="ui-alert-danger">{error}</div> : null}

            <button type="submit" disabled={!canSubmit} className="ui-button ui-button-primary login-submit">
              {busy ? "Logging in…" : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
