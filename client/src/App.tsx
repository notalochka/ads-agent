import { NavLink, Route, Routes } from "react-router-dom";
import { ResearchPage } from "./pages/ResearchPage";
import { ReportPage } from "./pages/ReportPage";

export default function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1>AdsRadar</h1>
            <p>Competitor ads intelligence for Meta Ad Library research</p>
          </div>
          <nav>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Research
            </NavLink>
            <NavLink
              to="/report"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Report
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-shell">
        <Routes>
          <Route path="/" element={<ResearchPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  );
}
