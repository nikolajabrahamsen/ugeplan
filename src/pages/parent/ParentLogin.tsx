import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function ParentLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Naviger til forældre-dashboardet så snart der er en aktiv session -
    // både ved almindeligt login og når magic-link-callbacket rammer siden
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/parent");
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="app-logo-mark" aria-hidden="true">
          🗓️
        </div>
        <h1>Log ind som forælder</h1>
        {sent ? (
          <p className="auth-confirmation">
            Vi har sendt et login-link til <strong>{email}</strong>. Tjek din indbakke.
          </p>
        ) : (
          <form onSubmit={handleMagicLink}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-full">
              Send login-link
            </button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
