import { useEffect, useState } from "react";

/**
 * Tilbyder installation af appen som en "rigtig" app på hjemmeskærmen.
 * - Android/Chrome/Edge: fanger beforeinstallprompt og viser en knap der
 *   trigger den native installations-dialog.
 * - iOS Safari understøtter IKKE beforeinstallprompt overhovedet - der
 *   vises i stedet en kort vejledning til "Del -> Føj til hjemmeskærm".
 * - Skjuler sig selv hvis appen allerede kører installeret (standalone).
 */
export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (isStandalone) return null;
  if (!deferredPrompt && !isIOS) return null; // ingen installationsmulighed tilgængelig endnu

  async function handleInstallClick() {
    if (isIOS) {
      setShowIOSHelp(true);
      return;
    }
    const promptEvent = deferredPrompt as Event & { prompt: () => void };
    promptEvent.prompt();
    setDeferredPrompt(null);
  }

  return (
    <div className="install-prompt">
      <button type="button" className="btn btn-secondary btn-small" onClick={handleInstallClick}>
        📲 Installér app
      </button>
      {showIOSHelp && (
        <p className="install-ios-help">
          Tryk på <strong>Del</strong>-ikonet nederst i Safari, og vælg{" "}
          <strong>"Føj til hjemmeskærm"</strong>.
        </p>
      )}
    </div>
  );
}
