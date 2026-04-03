import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-github-border)] py-8">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-github-muted)]">
        <div className="flex items-center gap-4">
          <span>GitScope</span>
          <a
            href="https://github.com/Sagargupta16/GitScope"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-github-muted)] hover:text-white no-underline transition-colors"
          >
            GitHub
          </a>
          <Link
            to="/privacy"
            className="text-[var(--color-github-muted)] hover:text-white no-underline transition-colors"
          >
            Privacy
          </Link>
        </div>
        <span>MIT License</span>
      </div>
    </footer>
  );
}
