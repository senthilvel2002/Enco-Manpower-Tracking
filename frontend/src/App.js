import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import RefreshRedirectsToHome from "./RefreshRedirectsToHome";
import Home from "./Home";
import WorkerLogin from "./WorkerLogin";
import AdminLogin from "./AdminLogin";
import WorkerDataEntry from "./WorkerDataEntry";
import EquipmentLogin from "./EquipmentLogin";
import EquipmentDataEntry from "./EquipmentDataEntry";
import SiteInchargeLogin from "./SiteInchargeLogin";
import ManagementLogin from "./ManagementLogin";
import ManagementView from "./ManagementView";
import WorkerProfileView from "./WorkerProfileView";
import SiteInchargeView from "./SiteInchargeView";
import NotLoggedWorkersView from "./NotLoggedWorkersView";

function App() {
  return (
    <Router>
      <RefreshRedirectsToHome />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/worker" element={<WorkerLogin />} />
        <Route path="/worker-entry" element={<WorkerDataEntry />} />
        <Route path="/equipment" element={<EquipmentLogin />} />
        <Route path="/equipment-entry" element={<EquipmentDataEntry />} />
        <Route path="/site-incharge-login" element={<SiteInchargeLogin />} />
        <Route path="/management-login" element={<ManagementLogin />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/management" element={<ManagementView />} />
        <Route path="/management/not-logged" element={<NotLoggedWorkersView />} />
        <Route path="/worker-profiles" element={<WorkerProfileView />} />
        <Route path="/site-incharge" element={<SiteInchargeView />} />
      </Routes>
    </Router>
  );
}

export default App;