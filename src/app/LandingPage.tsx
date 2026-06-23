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
          schematics for live events, with views of full systems, distros, circuits, equipment loads and
          PDF reporting.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          [
            "Power Planning",
            "Design complete temporary power systems before arriving on site, with clear schematics and load calculations.",
          ],
          [
            "Distro Management",
            "Model distribution exactly as it will be deployed. See all distros, circuits and loads in one place.",
          ],
          [
            "Load Calculations",
            "Automatic load and phase balancing as you build. See total load, phase load and circuit load at a glance.",
          ],
          [
            "Equipment Library",
            "Standardise planning using your own inventory integrated directly into LVA Power Planner.",
          ],
          [
            "System Warnings",
            "Identify potential issues and safety concerns before deployment, with clear warnings and visual indicators.",
          ],
          [
            "Exportable Reports",
            "Produce PDF reports to ensure consistency on-site and maintain project records.",
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
