'use client'

import { useEffect, useState } from 'react'
import { Icon, Sheet } from './ui'
import { isAndroid, isIOS, isStandalone } from '@/lib/pushClient'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }

/** Fired by App when the browser offers its own install prompt (Android, Chrome/Edge on computers). */
export const INSTALL_READY = 'schedule-bot:install-ready'

const grabbed = () => (typeof window === 'undefined' ? null : ((window as unknown as { __bip?: InstallEvent }).__bip ?? null))

/** Whether we're already running as the installed app, and the browser's one-tap prompt if it gave us one. */
export function useInstall() {
  const [installed, setInstalled] = useState(true) // assume installed until we know, so nothing flashes
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  useEffect(() => {
    setInstalled(isStandalone())
    setPrompt(grabbed())
    const ready = () => setPrompt(grabbed())
    const done = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener(INSTALL_READY, ready)
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener(INSTALL_READY, ready)
      window.removeEventListener('appinstalled', done)
    }
  }, [])
  return { installed, prompt }
}

/** Step-by-step for phones whose browser won't install with one tap (every iPhone). */
function InstallGuide({ onClose }: { onClose: () => void }) {
  const ios = isIOS()
  const safari = ios && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
  return (
    <Sheet title="Install My Schedule Bot" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="muted">It puts an icon on your Home Screen and opens like a regular app, with alerts.</div>
        {ios ? (
          <>
            {!safari && (
              <div className="card pad small">
                Tip: this works best in <b>Safari</b>. If you don&apos;t see “Add to Home Screen”, open this page in Safari.
              </div>
            )}
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">1</span>
                <div>
                  Tap the <b>Share</b> button {safari ? 'at the bottom of the screen' : 'next to the web address'}
                </div>
              </div>
              <div className="mock">
                <div className="mock-row hl" style={{ justifyContent: 'center', fontSize: 24 }}>
                  <Icon name="share" size={26} />
                </div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">2</span>
                <div>
                  Scroll down and tap <b>Add to Home Screen</b>
                </div>
              </div>
              <div className="mock">
                <div className="mock-row hl">
                  ➕ Add to Home Screen
                </div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">3</span>
                <div>
                  Tap <b>Add</b>, then open <b>Schedule Bot</b> from your Home Screen
                </div>
              </div>
              <div className="mock">
                <div className="mock-menu">
                  <div className="mock-app">📅</div>
                  <b>Schedule Bot</b>
                </div>
              </div>
            </div>
          </>
        ) : isAndroid() ? (
          <>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">1</span>
                <div>
                  Tap the <b>⋮</b> menu at the top right of Chrome
                </div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">2</span>
                <div>
                  Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>
                </div>
              </div>
              <div className="mock">
                <div className="mock-row hl">📲 Add to Home screen</div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">3</span>
                <div>
                  Open <b>Schedule Bot</b> from your Home Screen
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="guide-step">
            <div className="guide-text">
              <span className="guide-n">1</span>
              <div>
                In Chrome or Edge, click the <b>install icon</b> at the right end of the web address bar (a little screen with an arrow), then <b>Install</b>. Or open the browser menu and choose <b>Install My Schedule Bot</b>.
              </div>
            </div>
          </div>
        )}
        <button className="btn primary full xl" onClick={onClose}>
          Got It
        </button>
      </div>
    </Sheet>
  )
}

/** Big "Install the App" button: one tap where the browser allows it, otherwise the picture guide. Hidden once installed. */
export function InstallButton({ className = 'btn primary full xl', label = 'Install the App' }: { className?: string; label?: string }) {
  const { installed, prompt } = useInstall()
  const [guide, setGuide] = useState(false)
  if (installed) return null
  const go = async () => {
    if (prompt) {
      await prompt.prompt().catch(() => setGuide(true))
      return
    }
    setGuide(true)
  }
  return (
    <>
      <button className={className} onClick={go}>
        <Icon name="download" /> {label}
      </button>
      {guide && <InstallGuide onClose={() => setGuide(false)} />}
    </>
  )
}
