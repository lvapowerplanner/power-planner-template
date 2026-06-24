export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans">
      <header className="flex justify-center px-6 py-8">
        <img
          src="/lva-logo.png"
          alt="LVA Power Planner"
          className="h-32 w-32 object-contain"
        />
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          Power planning software for live events & temporary power systems
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600 md:text-xl">
          LVA Power Planner helps production teams build clear, structured power
          plans for generators, distros, circuits, equipment loads and
          professional reports.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          [
            "Power Planning",
            "Plan power sources and understand available capacity before arriving on site.",
          ],
          [
            "Distro Management",
            "Build realistic distribution systems with custom distros and circuit layouts.",
          ],
          [
            "Load Calculations",
            "Calculate connected loads, demand and phase balance quickly and consistently.",
          ],
          [
            "Equipment Library",
            "Store commonly used equipment across custom defined categories.",
          ],
          [
            "System Overview",
            "See the full temporary power system in a clear, easy-to-follow layout.",
          ],
          [
            "Exportable Reports",
            "Produce professional reports for onsite teams and project records.",
          ],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-3 text-gray-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="bg-black px-6 py-20 text-center text-white">
        <h2 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight">
          Built for AV companies, production teams and temporary power
          specialists.
        </h2>

        <p className="mx-auto mt-5 max-w-3xl text-gray-300">
          Replace disconnected spreadsheets with a focused planning tool
          designed for real-world event power workflows.
        </p>

        <p className="mx-auto mt-8 max-w-2xl text-lg text-white"> 
          To arrange a personalised demonstration and discuss how LVA Power Planner can support your projects, contact us at{" "} 
          <a href="mailto:hello@lvapowerplanner.com" className="font-semibold underline underline-offset-4" > hello@lvapowerplanner.com </a> . 
        </p>

        <p className="mx-auto mt-5 text-white">
          <a href="/docs" className="font-semibold underline underline-offset-4">
            View the online documentation centre
          </a>
        </p>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-gray-500">
        <p className="mx-auto max-w-4xl">
          LVA Power Planner is an indicative planning tool. It may support BS 7909 documentation workflows, but it does not verify, certify or guarantee compliance with BS 7909, BS 7671 or any other standard. Responsibility remains with the user and competent duty holder.
        </p>
        <p className="mt-4">© {new Date().getFullYear()} LVA Power Planner</p>
      </footer>
    </main>
  );
}
