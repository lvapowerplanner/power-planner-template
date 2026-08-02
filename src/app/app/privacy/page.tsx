export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-black font-sans">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm text-gray-500 underline underline-offset-4">
          Back to LVA Power Planner
        </a>

        <h1 className="mt-8 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-gray-500">Last updated: June 2026</p>

        <div className="mt-8 space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-black">Who we are</h2>
            <p className="mt-3">
              LVA Power Planner provides cloud-based power planning software for live events, production and AV workflows. This Privacy Policy explains how we collect, use and protect personal information when you use our website or software.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Information we collect</h2>
            <p className="mt-3">We may collect and process the following information:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Name, email address and company details.</li>
              <li>Account login and authentication information.</li>
              <li>Project information entered into the platform.</li>
              <li>Workspace settings, branding and configuration data.</li>
              <li>Technical information required to operate, secure and maintain the service.</li>
              <li>Support or enquiry information you choose to send to us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">How we use your information</h2>
            <p className="mt-3">We use personal information to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide access to LVA Power Planner.</li>
              <li>Create and manage user accounts and workspaces.</li>
              <li>Store, retrieve and save project data.</li>
              <li>Provide support and respond to enquiries.</li>
              <li>Maintain the security, reliability and performance of the service.</li>
              <li>Meet legal, accounting or administrative obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Legal basis for processing</h2>
            <p className="mt-3">
              We process personal information where it is necessary to provide the service, where we have a legitimate interest in operating and securing the platform, where we need to comply with legal obligations, or where you have given consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Data storage and processors</h2>
            <p className="mt-3">
              We use trusted third-party infrastructure and service providers to host, secure and operate the platform. These may include cloud hosting, database, authentication, deployment and email services. We only use providers where reasonably necessary to deliver the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Data retention</h2>
            <p className="mt-3">
              We retain personal information only for as long as reasonably required to provide the service, maintain records, resolve disputes, meet legal obligations or support legitimate business purposes. Project and account data may be deleted following account closure, subject to any legal or operational retention requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Your rights</h2>
            <p className="mt-3">
              Under applicable data protection law, you may have rights to access, correct, delete, restrict or request a copy of your personal information. You may also object to certain processing or withdraw consent where processing is based on consent.
            </p>
            <p className="mt-3">
              To exercise these rights, contact us at{" "}
              <a href="mailto:hello@lvapowerplanner.com" className="font-semibold underline underline-offset-4">
                hello@lvapowerplanner.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Cookies and analytics</h2>
            <p className="mt-3">
              LVA Power Planner may use essential cookies or similar technologies required for login, authentication and security. If analytics or marketing tracking is introduced in the future, this policy may be updated and additional consent controls may be added where required.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Contact</h2>
            <p className="mt-3">
              For privacy questions or requests, contact{" "}
              <a href="mailto:hello@lvapowerplanner.com" className="font-semibold underline underline-offset-4">
                hello@lvapowerplanner.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black">Changes to this policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. Continued use of the service after updates are published means you accept the revised policy.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
