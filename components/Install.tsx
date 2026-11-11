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
  const chrome = /CriOS/.test(navigator.userAgent)
  return (
    <Sheet title={ios ? 'Add to your Home Screen' : 'Install My Schedule Bot'} onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="muted">
          {ios
            ? 'Apple doesn’t let apps install themselves on iPhone, so it’s a few quick taps. After that, Schedule Bot gets its own icon and works like any other app, with alerts.'
            : 'It puts an icon on your Home Screen and opens like a regular app, with alerts.'}
        </div>
        {ios ? (
          <>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">1</span>
                <div>
                  {chrome ? (
                    <>
                      Tap the <b>Share</b> button at the top right, next to the web address
                    </>
                  ) : (
                    <>
                      Close this box, then tap the <b>Share</b> button at the <b>bottom</b> of Safari
                    </>
                  )}
                </div>
              </div>
              <div className="mock">
                {chrome ? (
                  <div className="mock-bar">
                    <span className="ellipsis grow">my-schedule-bot.vercel.app</span>
                    <span className="hl-ring mock-icon">
                      <Icon name="share" size={18} />
                    </span>
                  </div>
                ) : (
                  <div className="mock-toolbar" aria-hidden>
                    <span>‹</span>
                    <span>›</span>
                    <span className="hl-ring mock-icon">
                      <Icon name="share" size={18} />
                    </span>
                    <span>📖</span>
                    <span>⧉</span>
                  </div>
                )}
                {!chrome && (
                  <div className="small muted">
                    No Share button on the bar? On newer iPhones tap <b>⋯</b> at the bottom right first, then <b>Share</b>.
                  </div>
                )}
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">2</span>
                <div>
                  Scroll down the list and tap <b>Add to Home Screen</b>
                </div>
              </div>
              <div className="mock">
                <div className="mock-row hl">
                  <span className="mock-plus">+</span> Add to Home Screen
                </div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">3</span>
                <div>
                  If you see <b>Open as Web App</b>, leave it switched on. Then tap <b>Add</b> at the top right
                </div>
              </div>
              <div className="mock">
                <div className="mock-row">
                  Open as Web App <span className="hl-ring"><span className="mock-toggle" aria-hidden /></span>
                </div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-text">
                <span className="guide-n">4</span>
                <div>
                  Go to your Home Screen and open <b>Schedule Bot</b> from its new icon
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
export function InstallButton({
  className = 'btn primary full xl',
  label = 'Install the App',
  iosLabel = 'Add to Home Screen',
}: {
  className?: string
  label?: string
  /** iPhones can't install with a tap, so the button says what he'll actually do. */
  iosLabel?: string
}) {
  const { installed, prompt } = useInstall()
  const [guide, setGuide] = useState(false)
  if (installed) return null
  const ios = isIOS()
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
        <Icon name={ios ? 'share' : 'download'} /> {ios ? iosLabel : label}
      </button>
      {guide && <InstallGuide onClose={() => setGuide(false)} />}
    </>
  )
}
