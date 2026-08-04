import Link from "next/link";

const features = [
  {
    title: "System Planning",
    text: "Build complete source-to-circuit power hierarchies with manual supplies, downstream distros and live load propagation.",
  },
  {
    title: "Distro & Equipment Management",
    text: "Use company libraries, project-specific equipment and custom distro models to represent real event systems accurately.",
  },
  {
    title: "Load & Demand",
    text: "Compare connected and design load, apply circuit diversity and power factor, and monitor phase balance throughout the system.",
  },
  {
    title: "Cable Design",
    text: "Configure inbound and circuit cables, parallel runs and derating while reviewing capacity, utilisation and cumulative voltage drop.",
  },
  {
    title: "Protection Forecasting",
    text: "Record protective devices, review indicative device coordination and fault capability, and assess residual-current selectivity.",
  },
  {
    title: "Advanced Overview",
    text: "Bring warnings, advanced demand and the connected system hierarchy together in one clear design review workspace.",
  },
  {
    title: "Professional Reports",
    text: "Create branded system and distro reports, targeted advanced calculation packs and live view-only report links.",
  },
  {
    title: "System Sign-Off",
    text: "Prepare G1, G2 and G3 documentation, prepopulate circuit schedules and manage completion records in one workflow.",
  },
  {
    title: "External Electrician Access",
    text: "Issue secure editable links to freelance electricians, then export or submit the completed sign-off pack by email.",
  },
];

const workflow = [
  "Add supplies and distros",
  "Assign equipment and downstream feeds",
  "Review demand, cables and protection",
  "Issue reports and complete sign-off",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white font-sans text-black">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-7">
        <img
          src="/lva-logo.png"
          alt="LVA Power Planner"
          className="h-24 w-24 object-contain"
        />

        <nav className="flex items-center gap-5 text-sm font-semibold text-gray-600">
          <Link href="/docs" className="transition-colors hover:text-black">
            Documentation
          </Link>
          <a
            href="mailto:hello@lvapowerplanner.com"
            className="rounded-full bg-black px-5 py-3 text-white transition-colors hover:bg-gray-800"
          >
            Arrange a demo
          </a>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-14 text-center md:pt-20">
        <p className="mx-auto mb-6 w-fit rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600">
          Plan · Calculate · Document · Sign off
        </p>

        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          Temporary power planning,
          <span className="block text-gray-500">from first design to final sign-off.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-gray-600 md:text-xl">
          LVA Power Planner gives production teams one structured workspace for
          sources, distros, equipment loads, advanced electrical design,
          professional reports and system sign-off documentation.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <a
            href="mailto:hello@lvapowerplanner.com"
            className="rounded-xl bg-black px-6 py-3.5 font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Arrange a personalised demonstration
          </a>
          <Link
            href="/docs"
            className="rounded-xl border border-gray-300 px-6 py-3.5 font-semibold transition-colors hover:border-black"
          >
            Explore the documentation
          </Link>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500">
              One connected project model
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              Changes flow through the complete system.
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              Equipment assignments, downstream distro loads and design
              assumptions remain connected, helping teams avoid rebuilding the
              same information across separate spreadsheets and forms.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {workflow.map((step, index) => (
              <div key={step} className="rounded-2xl border border-gray-200 bg-white p-5">
                <span className="text-sm font-bold text-gray-400">0{index + 1}</span>
                <p className="mt-3 font-semibold leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500">
            Built for real temporary power workflows
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Planning tools and project documentation in one place.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-gray-200 p-6 transition-shadow hover:shadow-lg"
            >
              <h3 className="text-xl font-bold">{feature.title}</h3>
              <p className="mt-3 leading-7 text-gray-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid overflow-hidden rounded-3xl bg-black text-white md:grid-cols-2">
          <div className="p-8 md:p-12">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Advanced electrical workflow
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Move beyond connected-load planning.
            </h2>
            <p className="mt-5 leading-7 text-gray-300">
              Advanced workspaces add diversity, power factor, cable design,
              voltage drop, protection forecasting and designer review without
              complicating the core planning workflow for other users.
            </p>
          </div>

          <div className="border-t border-gray-800 p-8 md:border-l md:border-t-0 md:p-12">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
              System Sign-Off
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Keep design and completion records connected.
            </h2>
            <p className="mt-5 leading-7 text-gray-300">
              Select project circuits for G2, prepare G1 and G3 documentation,
              collaborate with external electricians and issue a branded PDF
              sign-off pack from the same project.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-black px-6 py-20 text-center text-white">
        <h2 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight">
          Built for AV companies, production teams and temporary power specialists.
        </h2>

        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-gray-300">
          See how LVA Power Planner can support your company libraries, planning
          standards, project reports and sign-off workflow.
        </p>

        <a
          href="mailto:hello@lvapowerplanner.com"
          className="mt-8 inline-flex rounded-xl bg-white px-6 py-3.5 font-semibold text-black transition-colors hover:bg-gray-200"
        >
          Contact hello@lvapowerplanner.com
        </a>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-gray-500">
        <p className="mx-auto max-w-4xl leading-6">
          LVA Power Planner is an indicative planning and documentation tool. It
          may support BS 7909 workflows, but it does not verify, certify or
          guarantee compliance with BS 7909, BS 7671 or any other standard.
          Responsibility remains with the user and competent duty holder.
        </p>
        <p className="mt-4">© {new Date().getFullYear()} LVA Power Planner</p>
        <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
          <Link href="/privacy" className="transition-colors hover:text-black">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-black">
            Terms &amp; Conditions
          </Link>
          <Link href="/docs" className="transition-colors hover:text-black">
            Documentation
          </Link>
        </div>
      </footer>
    </main>
  );
}
