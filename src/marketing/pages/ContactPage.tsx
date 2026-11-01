import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";

/** Temporary delivery target — UI shows branded labels only. */
const MAILTO_TARGET = "asiedudev.hub@gmail.com";

const CHANNELS = [
  {
    label: "General",
    display: "hello@icanova.com",
    subjectPrefix: "iCaNova · General",
    hint: "Product questions, partnerships, introductions",
  },
  {
    label: "Support",
    display: "support@icanova.com",
    subjectPrefix: "iCaNova · Support",
    hint: "Gateway registration, monitoring access, alarms",
  },
] as const;

export function ContactPage() {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["label"]>("General");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Contact · iCaNova Monitoring";
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const selected = CHANNELS.find((c) => c.label === channel) ?? CHANNELS[0];
    const subject = encodeURIComponent(
      `${selected.subjectPrefix}${name.trim() ? ` — ${name.trim()}` : ""}`,
    );
    const body = encodeURIComponent(
      [
        name.trim() ? `Name: ${name.trim()}` : null,
        `Channel: ${selected.label} (${selected.display})`,
        "",
        message.trim() || "(no message)",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    window.location.href = `mailto:${MAILTO_TARGET}?subject=${subject}&body=${body}`;
  }

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero" aria-labelledby="contact-hero-title">
          <div className="mkt-inner mkt-page-hero-copy" data-mkt-reveal data-mkt-from="up">
            <p className="mkt-eyebrow">Contact</p>
            <h1 id="contact-hero-title">Talk to iCaNova</h1>
            <p className="mkt-lede">
              Reach the team about Edge Gateways, monitoring access or partnership. The form opens
              your email app with a prefilled draft — nothing is sent from this site.
            </p>
          </div>
        </section>

        <section className="mkt-section mkt-section-tight mkt-mist mkt-curve-shell">
          <div className="mkt-inner mkt-contact-layout">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Channels</p>
              <h2>Branded addresses</h2>
              <p className="mkt-copy mkt-copy-narrow">
                Product identity uses iCaNova addresses in the UI. Drafts currently deliver through
                our inbox relay.
              </p>
              <div className="mkt-contact-channels">
                {CHANNELS.map((c) => (
                  <div key={c.label} className="mkt-contact-channel">
                    <span className="mkt-contact-channel-label">{c.label}</span>
                    <span className="mkt-contact-channel-addr">{c.display}</span>
                    <span className="mkt-contact-channel-hint">{c.hint}</span>
                  </div>
                ))}
              </div>
              <p className="mkt-section-more">
                <Link className="mkt-text-link" to="/about">
                  About iCaNova
                </Link>
              </p>
            </div>

            <form
              className="mkt-contact-form mkt-contact-panel"
              onSubmit={onSubmit}
              data-mkt-reveal
              data-mkt-from="right"
              data-mkt-delay="1"
            >
              <label className="mkt-field">
                <span>Your name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="mkt-field">
                <span>Topic</span>
                <select
                  name="channel"
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as (typeof CHANNELS)[number]["label"])
                  }
                >
                  {CHANNELS.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label} — {c.display}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mkt-field">
                <span>Message</span>
                <textarea
                  name="message"
                  rows={7}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                />
              </label>
              <p className="mkt-contact-note">
                Opens your email app. Nothing is stored or sent from this site.
              </p>
              <button type="submit" className="mkt-btn mkt-btn-primary mkt-btn-lg">
                Open email draft
              </button>
            </form>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
