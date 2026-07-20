import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentLogin from "./pages/parent/ParentLogin";
import WeeklyPlanEditor from "./pages/parent/WeeklyPlanEditor";
import RequireAuth from "./components/RequireAuth";
import ChildProfilePicker from "./pages/child/ChildProfilePicker";
import ChildWeeklyView from "./pages/child/ChildWeeklyView";
import PairDevice from "./pages/child/PairDevice";

// Selv-hostede fonte (ingen ekstern Google Fonts-forbindelse - vigtigt
// både for offline-brug og for at holde data inden for egen infrastruktur)
import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Forældre-del: kræver Supabase Auth-login */}
        <Route path="/login" element={<ParentLogin />} />
        <Route
          path="/parent"
          element={
            <RequireAuth>
              <ParentDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/parent/child/:childId/plan"
          element={
            <RequireAuth>
              <WeeklyPlanEditor />
            </RequireAuth>
          }
        />

        {/* Offentlig: barnets enhed parres her, uden nogen session i forvejen */}
        <Route path="/pair" element={<PairDevice />} />

        {/* Børne-del: låst "kiosk" visning. Beskyttet af RequireAuth -
            enten en forælders session, eller en enheds egen anonyme
            session efter parring via /pair. */}
        <Route
          path="/child"
          element={
            <RequireAuth>
              <ChildProfilePicker />
            </RequireAuth>
          }
        />
        <Route
          path="/child/:childId/week"
          element={
            <RequireAuth>
              <ChildWeeklyView />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
