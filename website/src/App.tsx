import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Compare } from "./pages/Compare";
import { Privacy } from "./pages/Privacy";
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
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
