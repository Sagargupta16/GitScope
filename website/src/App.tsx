import { lazy, Suspense } from "react";
import { Routes, Route, Link, useLocation } from "react-router";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { useAuth, getAuthSessionId } from "./lib/auth";
import { LoginReturn } from "./components/LoginLink";

const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const Compare = lazy(() => import("./pages/Compare").then((m) => ({ default: m.Compare })));
const Leaderboard = lazy(() => import("./pages/Leaderboard").then((m) => ({ default: m.Leaderboard })));
const Privacy = lazy(() => import("./pages/Privacy").then((m) => ({ default: m.Privacy })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const RepoDetail = lazy(() => import("./pages/RepoDetail").then((m) => ({ default: m.RepoDetail })));

export function App() {
  const location = useLocation();
  const { token, login, scopes } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <LoginReturn />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header key={location.pathname} />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0">
        <RouteErrorBoundary key={`${location.pathname}:${getAuthSessionId()}:${login}:${Boolean(token)}:${JSON.stringify(scopes)}`}>
          <Suspense fallback={<p role="status" aria-live="polite" className="py-20 px-6 text-center">Loading page…</p>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/repo/:name" element={<RepoDetail />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={
                <section className="py-20 px-6 text-center">
                  <h1 className="text-3xl font-bold mb-4">Page not found</h1>
                  <p className="text-[var(--color-github-muted)] mb-6">This address doesn’t match a GitScope page.</p>
                  <Link to="/" className="text-[var(--color-brand-light)] underline">Go to home</Link>
                </section>
              } />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
