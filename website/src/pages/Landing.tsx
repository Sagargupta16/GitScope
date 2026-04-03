import { Link } from "react-router-dom";

const features = [
  {
    title: "Contribution Streaks",
    description: "Track current and longest contribution streaks at a glance.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Language Breakdown",
    description: "Color-coded bar chart showing your language distribution across repos.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    title: "Coding Personality",
    description: "Are you a Builder, Reviewer, or Collaborator? Find out from your contribution mix.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    title: "Activity Heatmap",
    description: "Compact 20-week contribution heatmap showing your recent coding activity.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: "Profile Comparison",
    description: "Compare any two GitHub profiles side by side - stars, repos, PRs, and more.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: "Velocity Tracking",
    description: "See if you're speeding up or slowing down compared to the past month.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            GitHub Profile Insights
          </h1>
          <p className="text-xl text-[var(--color-github-muted)] mb-8 max-w-2xl mx-auto">
            A browser extension that adds contribution streaks, language breakdown,
            PR stats, and activity charts to any GitHub profile.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="https://chromewebstore.google.com/detail/gitscope/fndaanihifimmlnmkjdmjbbkbdajolff"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-6 py-3 rounded-lg text-base font-semibold no-underline transition-colors"
            >
              Install for Chrome
            </a>
            <Link
              to="/compare"
              className="border border-[var(--color-github-border)] hover:border-[var(--color-github-muted)] text-white px-6 py-3 rounded-lg text-base font-semibold no-underline transition-colors"
            >
              Compare Profiles
            </Link>
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-lg border border-[var(--color-github-border)] overflow-hidden bg-[var(--color-github-dark)]">
            <img
              src="https://raw.githubusercontent.com/Sagargupta16/GitScope/main/images/gitscope-dark-top.jpg"
              alt="GitScope dashboard showing stats, languages, and heatmap"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-[var(--color-github-dark)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-darker)] hover:border-[var(--color-github-muted)] transition-colors"
              >
                <div className="text-[var(--color-brand)] mb-3">{f.icon}</div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--color-github-muted)] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare CTA */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Compare GitHub Profiles</h2>
          <p className="text-[var(--color-github-muted)] mb-8">
            Enter any two GitHub usernames and see a side-by-side comparison of
            stars, repos, languages, and more. No sign-in required for basic stats.
          </p>
          <Link
            to="/compare"
            className="inline-block bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-6 py-3 rounded-lg text-base font-semibold no-underline transition-colors"
          >
            Try it now
          </Link>
        </div>
      </section>
    </>
  );
}
