import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type Mode = "password" | "sendCode" | "verifyCode" | "setPassword";

const MIN_PASSWORD_LENGTH = 8;

export default function ParentLogin() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Naviger til forældre-dashboardet så snart der er en aktiv session -
    // MEN ikke hvis vi lige er midt i at sætte et nyt kodeord op, for så
    // er brugeren allerede "logget ind" via koden, men mangler stadig
    // at vælge sit kodeord.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && mode !== "setPassword" && mode !== "verifyCode") {
        navigate("/parent");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate, mode]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Forkert email eller adgangskode.");
      return;
    }
    // onAuthStateChange ovenfor navigerer videre
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMode("verifyCode");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email"
    });
    setLoading(false);
    if (error) {
      setError("Forkert eller udløbet kode - prøv igen.");
      return;
    }
    setMode("setPassword");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn.`);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("Adgangskoderne er ikke ens.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/parent");
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="app-logo-mark" aria-hidden="true">
          🗓️
        </div>

        {mode === "password" && (
          <>
            <h1>Log ind som forælder</h1>
            <form onSubmit={handlePasswordLogin}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="password">Adgangskode</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? "Logger ind..." : "Log ind"}
              </button>
            </form>
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={() => {
                setMode("sendCode");
                setError(null);
              }}
            >
              Første gang, eller glemt adgangskode?
            </button>
          </>
        )}

        {mode === "sendCode" && (
          <>
            <h1>Log ind med email-kode</h1>
            <form onSubmit={handleSendCode}>
              <label htmlFor="email-code">Email</label>
              <input
                id="email-code"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? "Sender..." : "Send kode"}
              </button>
            </form>
            <button type="button" className="btn btn-ghost btn-full" onClick={() => setMode("password")}>
              ← Tilbage til login
            </button>
          </>
        )}

        {mode === "verifyCode" && (
          <>
            <h1>Indtast kode</h1>
            <form onSubmit={handleVerifyCode}>
              <p className="auth-confirmation">
                Vi har sendt en 6-cifret kode til <strong>{email}</strong>.
              </p>
              <label htmlFor="code">Kode</label>
              <input
                id="code"
                type="text"
                className="pairing-code-input"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                autoFocus
                required
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? "Bekræfter..." : "Bekræft"}
              </button>
            </form>
          </>
        )}

        {mode === "setPassword" && (
          <>
            <h1>Vælg en adgangskode</h1>
            <p className="auth-confirmation">
              Brug denne adgangskode til at logge ind fremover - I skal ikke bruge en kode fra
              mailen hver gang.
            </p>
            <form onSubmit={handleSetPassword}>
              <label htmlFor="new-password">Ny adgangskode (mindst {MIN_PASSWORD_LENGTH} tegn)</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                autoFocus
                required
              />
              <label htmlFor="new-password-confirm">Gentag adgangskode</label>
              <input
                id="new-password-confirm"
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? "Gemmer..." : "Gem adgangskode og fortsæt"}
              </button>
            </form>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <p className="pair-device-link">
          <a href="/pair">Er det en barneenhed? Tilknyt den her</a>
        </p>
      </div>
    </div>
  );
}
