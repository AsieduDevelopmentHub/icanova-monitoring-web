import { useEffect, useMemo, useState } from "react";
import { fetchCatalog } from "./api";
import { formatWord, type GenCatalog, type GenReg } from "./gencomm";

export function Configure() {
  const [catalog, setCatalog] = useState<GenCatalog | null>(null);
  const [pageId, setPageId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [writableOnly, setWritableOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
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

  async function readPage() {
    setMessage("Readings come from Convex. This page does not call the gateway.");
  }

  async function writeReg(reg: GenReg) {
    void reg;
    setMessage("Controller writes are not sent to Convex.");
  }

  async function control(key: number, name: string, risk: boolean) {
    void key;
    void name;
    void risk;
    setMessage("Controller commands are not sent to Convex.");
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
        <button type="button" onClick={readPage}>
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
              onClick={() => control(cmd.k, cmd.n, !!cmd.risk)}
            >
              {cmd.n}
            </button>
          ))}
      </div>
      <p className="meta">Controller commands are not sent to Convex. Stop and off mode stay blocked on the gateway.</p>

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
                        <button type="button" onClick={() => writeReg(reg)}>
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
