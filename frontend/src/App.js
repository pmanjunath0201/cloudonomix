import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn, isSuperAdmin } from './utils/auth';
import Layout          from './components/Layout';
import Login           from './pages/Login';
import Register        from './pages/Register';
import VerifyEmail     from './pages/VerifyEmail';
import ForgotPassword  from './pages/ForgotPassword';
import ResetPassword   from './pages/ResetPassword';
import Dashboard       from './pages/Dashboard';
import Costs           from './pages/Costs';
import Scanner         from './pages/Scanner';
import Anomalies       from './pages/Anomalies';
import MultiCloud      from './pages/MultiCloud';
import Alerts          from './pages/Alerts';
import Compare         from './pages/Compare';
import Settings        from './pages/Settings';
import AdminPanel      from './pages/AdminPanel';
import Recommendations from './pages/Recommendations';
import Reports         from './pages/Reports';

const Guard = ({ children }) => isLoggedIn() ? children : <Navigate to="/login" replace/>;
const AdminGuard = ({ children }) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace/>;
  if (!isSuperAdmin()) return <Navigate to="/" replace/>;
  return children;
};
const Wrap = Page => <Guard><Layout><Page/></Layout></Guard>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<Login/>}/>
        <Route path="/register"        element={<Register/>}/>
        <Route path="/verify-email"    element={<VerifyEmail/>}/>
        <Route path="/forgot-password" element={<ForgotPassword/>}/>
        <Route path="/reset-password"  element={<ResetPassword/>}/>

        {/* Protected */}
        <Route path="/"           element={Wrap(Dashboard)}/>
        <Route path="/costs"      element={Wrap(Costs)}/>
        <Route path="/savings"    element={Wrap(Recommendations)}/>
        <Route path="/scanner"    element={Wrap(Scanner)}/>
        <Route path="/anomalies"  element={Wrap(Anomalies)}/>
        <Route path="/multicloud" element={Wrap(MultiCloud)}/>
        <Route path="/alerts"     element={Wrap(Alerts)}/>
        <Route path="/reports"    element={Wrap(Reports)}/>
        <Route path="/compare"    element={Wrap(Compare)}/>
        <Route path="/settings"   element={Wrap(Settings)}/>

        {/* Admin */}
        <Route path="/admin" element={<AdminGuard><Layout><AdminPanel/></Layout></AdminGuard>}/>
        <Route path="*"      element={<Navigate to="/" replace/>}/>
      </Routes>
    </BrowserRouter>
  );
}
