import Terminal from "./Terminal";

export const metadata = {
  title: "Terminal — Trabajoteca",
};

export default function TerminalPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-text mb-4">Scraper Terminal</h1>
      <Terminal />
    </main>
  );
}
