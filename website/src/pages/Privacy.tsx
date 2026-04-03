export function Privacy() {
  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-[var(--color-github-muted)] mb-4">Last updated: March 28, 2026</p>

        <div className="space-y-6 text-[var(--color-github-text)] text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">What GitScope Does</h2>
            <p>
              GitScope is a browser extension that adds a contribution insights dashboard
              to GitHub profile pages. It fetches publicly available data from GitHub's API
              to display stats, charts, and activity patterns.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Data Collection</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not collect, store, or transmit any personal data to our servers.</li>
              <li>Your GitHub OAuth token is stored locally in your browser using Chrome's storage API.</li>
              <li>API responses are cached locally for 5 minutes to reduce API calls.</li>
              <li>No analytics, tracking, or telemetry of any kind.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>GitHub API</strong> (api.github.com) - Used to fetch profile data.
                Subject to GitHub's privacy policy.
              </li>
              <li>
                <strong>Cloudflare Worker</strong> (gpi-auth.sg85207.workers.dev) - Used only
                during OAuth authentication to exchange the auth code for a token. The worker
                does not store tokens or any user data.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Permissions</h2>
            <p>
              The extension requests <code className="bg-[var(--color-github-dark)] px-1 rounded">read:user</code> scope
              to access contribution data via GitHub's GraphQL API. This is read-only access
              and cannot modify any data on your GitHub account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Open Source</h2>
            <p>
              GitScope is fully open source. You can audit the complete source code at{" "}
              <a
                href="https://github.com/Sagargupta16/GitScope"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-brand)] hover:underline"
              >
                github.com/Sagargupta16/GitScope
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contact</h2>
            <p>
              For privacy concerns, open an issue on the{" "}
              <a
                href="https://github.com/Sagargupta16/GitScope/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-brand)] hover:underline"
              >
                GitHub repository
              </a>.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
