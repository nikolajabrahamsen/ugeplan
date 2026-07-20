import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentLogin from "./pages/parent/ParentLogin";
import WeeklyPlanEditor from "./pages/parent/WeeklyPlanEditor";
import RequireAuth from "./components/RequireAuth";
import ChildProfilePicker from "./pages/child/ChildProfilePicker";
import ChildWeeklyView from "./pages/child/ChildWeeklyView";
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

        {/* Børne-del: låst "kiosk" visning, tilgås via profilvalg (PIN) efter forælder er logget ind */}
        <Route path="/child" element={<ChildProfilePicker />} />
        <Route path="/child/:childId/week" element={<ChildWeeklyView />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
