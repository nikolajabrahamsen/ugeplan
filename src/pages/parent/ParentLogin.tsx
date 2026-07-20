import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function ParentLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Naviger til forældre-dashboardet så snart der er en aktiv session
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/parent");
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

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
    setCodeSent(true);
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
    // onAuthStateChange-lytteren ovenfor navigerer videre til /parent
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="app-logo-mark" aria-hidden="true">
          🗓️
        </div>
        <h1>Log ind som forælder</h1>

        {!codeSent ? (
          <form onSubmit={handleSendCode}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? "Sender..." : "Send kode"}
            </button>
          </form>
        ) : (
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
              {loading ? "Bekræfter..." : "Log ind"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={() => {
                setCodeSent(false);
                setCode("");
              }}
            >
              Brug en anden email
            </button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
