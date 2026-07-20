import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function ParentLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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

  // NOTE: Efter magic-link callback bør en useEffect lytte på
  // supabase.auth.onAuthStateChange og navigere til /parent.
  // Udeladt her for overskuelighedens skyld i skelettet.
  void navigate;

  return (
    <div className="auth-screen">
      <h1>Log ind som forælder</h1>
      {sent ? (
        <p>Vi har sendt et login-link til {email}. Tjek din indbakke.</p>
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
          <button type="submit">Send login-link</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
