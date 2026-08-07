"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type ServerEntry =
  | { type: "start"; message: string; seq: number }
  | { type: "progress"; source: string; keyword: string; found: number; created: number; connected: number; seq: number }
  | { type: "error"; source: string; keyword: string; message: string; seq: number }
  | { type: "complete"; totalCreated: number; totalConnected: number; stopped?: boolean; seq: number };

type LogLine =
  | { type: "info"; text: string }
  | { type: "progress"; source: string; keyword: string; found: number; created: number; connected: number }
  | { type: "error"; source: string; keyword: string; text: string }
  | { type: "complete"; totalCreated: number; totalConnected: number; stopped?: boolean };

type StatusResponse = {
  running: boolean;
  startedAt: number | null;
  endedAt: number | null;
  logs: ServerEntry[];
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function toLogLine(entry: ServerEntry): LogLine {
  switch (entry.type) {
    case "start":
      return { type: "info", text: `▶ ${entry.message}` };
    case "progress":
      return {
        type: "progress",
        source: entry.source,
        keyword: entry.keyword,
        found: entry.found,
        created: entry.created,
        connected: entry.connected,
      };
    case "error":
      return { type: "error", source: entry.source, keyword: entry.keyword, text: entry.message };
    case "complete":
      return {
        type: "complete",
        totalCreated: entry.totalCreated,
        totalConnected: entry.totalConnected,
        stopped: entry.stopped,
      };
  }
}

export default function Terminal() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastSeqRef = useRef(0);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addLog = useCallback((line: LogLine) => {
    setLogs((prev) => [...prev, line]);
    setTimeout(scrollToBottom, 50);
  }, []);

  const connectStream = useCallback((since: number) => {
    const es = new EventSource(`/api/scrape/stream?since=${since}`);
    esRef.current = es;

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        es.close();
        esRef.current = null;
        setElapsedMs(Date.now() - startedAtRef.current);
        setRunning(false);
        setDone(true);
        return;
      }

      try {
        const entry: ServerEntry = JSON.parse(e.data);
        lastSeqRef.current = entry.seq;
        addLog(toLogLine(entry));
      } catch {
        addLog({ type: "info", text: e.data });
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setElapsedMs(Date.now() - startedAtRef.current);
      setRunning(false);
      setDone(true);
    };
  }, [addLog]);

  // Hydrate from whatever the server-side job is doing — picks up an
  // already-running (or already-finished) scrape after a page reload.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/scrape/status")
      .then((r) => r.json())
      .then((snap: StatusResponse) => {
        if (cancelled) return;

        setLogs(snap.logs.map(toLogLine));
        lastSeqRef.current = snap.logs.length ? snap.logs[snap.logs.length - 1].seq : 0;
        if (snap.startedAt) startedAtRef.current = snap.startedAt;

        if (snap.running) {
          setRunning(true);
          setElapsedMs(Date.now() - (snap.startedAt ?? Date.now()));
          connectStream(lastSeqRef.current);
        } else if (snap.logs.length > 0) {
          setDone(true);
          if (snap.startedAt && snap.endedAt) setElapsedMs(snap.endedAt - snap.startedAt);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const startScrape = async () => {
    if (running) return;
    setLogs([]);
    setRunning(true);
    setDone(false);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    lastSeqRef.current = 0;

    const res = await fetch("/api/scrape/start", { method: "POST" });
    const { started } = await res.json();
    if (!started) {
      // Another tab/reload already has a job running — just tail it.
      const status: StatusResponse = await fetch("/api/scrape/status").then((r) => r.json());
      if (status.startedAt) startedAtRef.current = status.startedAt;
      setLogs(status.logs.map(toLogLine));
      lastSeqRef.current = status.logs.length ? status.logs[status.logs.length - 1].seq : 0;
    }

    connectStream(lastSeqRef.current);
  };

  const stopScrape = async () => {
    await fetch("/api/scrape/stop", { method: "POST" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={startScrape}
          disabled={running}
          className="bg-accent text-accent-ink font-medium rounded px-4 py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {running ? "Scrapeando..." : "▶ Iniciar scraping"}
        </button>
        {running && (
          <button
            onClick={stopScrape}
            className="border border-border text-text font-medium rounded px-4 py-2 text-sm hover:bg-surface-alt transition"
          >
            ⏹ Detener
          </button>
        )}
        {(running || done) && (
          <span className="font-mono text-sm text-text-muted">{formatElapsed(elapsedMs)}</span>
        )}
        {done && (
          <span className="text-sm text-text-muted">Listo</span>
        )}
      </div>

      <div
        ref={logsRef}
        className="bg-bg border border-border rounded-lg p-4 font-mono text-[13px] leading-relaxed h-[60vh] overflow-y-auto"
      >
        {logs.length === 0 && !running && (
          <span className="text-text-muted">Presioná el botón para comenzar.</span>
        )}

        {logs.map((log, i) => {
          switch (log.type) {
            case "info":
              return (
                <div key={i} className="text-text-muted">
                  {log.text}
                </div>
              );
            case "progress":
              return (
                <div key={i} className="text-text">
                  <span className="text-accent">[{log.source}]</span>{" "}
                  <span className="text-text-muted">{log.keyword}</span> →{" "}
                  {log.found} encontrados, {log.created} nuevos, {log.connected} conectados
                </div>
              );
            case "error":
              return (
                <div key={i} className="text-red-400">
                  <span className="text-accent">[{log.source}]</span>{" "}
                  <span className="text-text-muted">{log.keyword}</span> →{" "}
                  Error: {log.text}
                </div>
              );
            case "complete":
              return (
                <div key={i} className="text-green-400 mt-1">
                  {log.stopped ? "⏹ Detenido" : "✅ Completado"}: {log.totalCreated} nuevos, {log.totalConnected} conectados
                </div>
              );
          }
        })}

        {running && (
          <div className="text-text-muted animate-pulse mt-1">_</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
