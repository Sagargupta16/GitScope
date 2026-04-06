import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Compare } from "./pages/Compare";
import { Leaderboard } from "./pages/Leaderboard";
import { Privacy } from "./pages/Privacy";
import { Dashboard } from "./pages/Dashboard";
import { RepoDetail } from "./pages/RepoDetail";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/repo/:name" element={<RepoDetail />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
