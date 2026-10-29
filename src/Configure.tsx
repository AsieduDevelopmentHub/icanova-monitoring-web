import { useEffect, useMemo, useState } from "react";
import { fetchCatalog, readWords, sendControl, writeWords } from "./api";
import {
  formatWord,
  readSpans,
  wordsForWrite,
  type GenCatalog,
  type GenPage,
  type GenReg,
} from "./gencomm";

const mock = import.meta.env.VITE_USE_MOCK === "1";

function applyWords(page: GenPage, addr: number, words: number[]): GenPage {
  const regs = page.regs.map((reg) => {
    const start = page.b + reg.o;
    const next = reg.v ? [...reg.v] : Array.from({ length: reg.w }, () => null);
    let touched = false;
    for (let i = 0; i < words.length; i++) {
      const at = addr + i;
      if (at >= start && at < start + reg.w) {
        next[at - start] = words[i];
        touched = true;
      }
    }
    return touched ? { ...reg, v: next } : reg;
  });
  return { ...page, regs };
}

export function Configure() {
  const [catalog, setCatalog] = useState<GenCatalog | null>(null);
  const [pageId, setPageId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [writableOnly, setWritableOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((next) => {
        if (!cancelled) {
          setCatalog(next);
          setPageId(next.pages[0]?.p ?? null);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "catalog failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const page = catalog?.pages.find((item) => item.p === pageId) ?? null;

  const rows = useMemo(() => {
    if (!page) {
      return [];
    }
    const q = query.trim().toLowerCase();
    return page.regs.filter((reg) => {
      if (writableOnly && reg.a === "r") {
        return false;
      }
      if (!q) {
        return true;
      }
      const addr = String(page.b + reg.o);
      return reg.n.toLowerCase().includes(q) || addr.includes(q);
    });
  }, [page, query, writableOnly]);

  function replacePage(next: GenPage) {
    setCatalog((current) =>
      current
        ? {
            ...current,
            pages: current.pages.map((item) => (item.p === next.p ? next : item)),
          }
        : current,
    );
  }

  async function readPage() {
    if (!page) {
      return;
    }
    if (mock) {
      setMessage("Showing the captured snapshot. Connect the gateway to read the module.");
      return;
    }
    setBusy(true);
    setMessage("Reading…");
    try {
      let next = page;
      for (const span of readSpans(page)) {
        const words = await readWords(span.addr, span.qty);
        next = applyWords(next, span.addr, words);
      }
      replacePage(next);
      setMessage(`Read page ${page.p}.`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "read failed");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function writeReg(reg: GenReg) {
    if (!page) {
      return;
    }
    const addr = page.b + reg.o;
    let words: number[];
    try {
      words = wordsForWrite(reg, drafts[addr] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "bad value");
      return;
    }
    const prompt = reg.comp
      ? `Write ${words[0]} and its complement ${words[1]} to ${addr} (${reg.n})? A wrong password locks the module after three tries.`
      : `Write ${words.join(", ")} to ${addr} (${reg.n})?`;
    if (!window.confirm(prompt)) {
      return;
    }
    if (mock) {
      replacePage(applyWords(page, addr, words.slice(0, reg.w)));
      setMessage("Stored on this page only. The module is not connected.");
      setError(null);
      return;
    }
    setBusy(true);
    try {
      await writeWords(addr, words);
      replacePage(applyWords(page, addr, words.slice(0, reg.w)));
      setMessage(`Wrote ${addr}.`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "write failed");
    } finally {
      setBusy(false);
    }
  }

  async function control(key: number, name: string, risk: boolean) {
    const prompt = risk
      ? `${name} can start the engine, change mode, or move a breaker. Send it?`
      : `Send “${name}”?`;
    if (!window.confirm(prompt)) {
      return;
    }
    if (mock) {
      setMessage("Not sent. The module is not connected.");
      return;
    }
    setBusy(true);
    try {
      await sendControl(key);
      setMessage(`Sent ${name}.`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "control failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !catalog) {
    return <p className="err">{error}</p>;
  }
  if (!catalog || !page) {
    return <p className="empty">Loading GenComm pages…</p>;
  }

  const writableCount = catalog.pages.reduce(
    (sum, item) => sum + item.regs.filter((reg) => reg.a !== "r").length,
    0,
  );

  return (
    <section className="section configure">
      <p className="meta">
        {catalog.device} model {catalog.model}. {catalog.pages.length} pages,{" "}
        {writableCount} writable registers. {catalog.wordOrder}.
      </p>
      <div className="tools">
        <select
          aria-label="GenComm page"
          value={page.p}
          onChange={(event) => setPageId(Number(event.target.value))}
        >
          {catalog.pages.map((item) => (
            <option key={item.p} value={item.p}>
              Page {item.p} — {item.t}
            </option>
          ))}
        </select>
        <input
          aria-label="Filter registers"
          placeholder="Filter name or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={writableOnly}
            onChange={(event) => setWritableOnly(event.target.checked)}
          />
          Writable only
        </label>
        <button type="button" onClick={readPage} disabled={busy}>
          Read page
        </button>
      </div>

      <h2>Control</h2>
      <div className="tools">
        {catalog.scf
          .filter((cmd) => !cmd.blocked)
          .map((cmd) => (
            <button
              key={cmd.k}
              type="button"
              disabled={busy}
              onClick={() => control(cmd.k, cmd.n, !!cmd.risk)}
            >
              {cmd.n}
            </button>
          ))}
      </div>
      <p className="meta">Stop and off mode stay blocked. Other control commands ask before they are sent.</p>

      <div className="table-wrap">
        <table className="cfg">
          <thead>
            <tr>
              <th>Address</th>
              <th>Name</th>
              <th>Access</th>
              <th>Value</th>
              <th>Write</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((reg) => {
              const addr = page.b + reg.o;
              const range =
                reg.mn || reg.mx ? `${reg.mn ?? ""}…${reg.mx ?? ""}` : "";
              return (
                <tr key={`${page.p}-${reg.o}`}>
                  <td>{addr}</td>
                  <td>
                    {reg.n}
                    {reg.ty ? <span className="meta"> {reg.ty}</span> : null}
                    {range ? <span className="meta"> {range}</span> : null}
                    {reg.comp ? (
                      <span className="meta"> writes value + ones complement</span>
                    ) : null}
                  </td>
                  <td>{reg.a === "rw" ? "read/write" : reg.a === "w" ? "write" : "read"}</td>
                  <td>
                    {(reg.v ?? []).map((word, index) => (
                      <div key={index}>{formatWord(word, reg.ty)}</div>
                    ))}
                    {reg.w === 2 && reg.v?.[0] != null && reg.v?.[1] != null ? (
                      <div className="meta">
                        uint32 {((reg.v[0]! << 16) | reg.v[1]!) >>> 0}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {reg.a === "r" ? null : (
                      <div className="tools">
                        <input
                          aria-label={`Write ${reg.n}`}
                          value={drafts[addr] ?? ""}
                          placeholder={reg.w > 1 && !reg.comp ? `${reg.w} words` : "value"}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [addr]: event.target.value,
                            }))
                          }
                        />
                        <button type="button" disabled={busy} onClick={() => writeReg(reg)}>
                          Write
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="empty">No registers match this filter.</p> : null}
      {message ? <p className="meta">{message}</p> : null}
      {error ? <p className="err">{error}</p> : null}
    </section>
  );
}
