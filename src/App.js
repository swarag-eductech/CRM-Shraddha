import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import MeetingsPage from './pages/MeetingsPage';
import WhatsAppPage from './pages/WhatsAppPage';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';
import TodayTasksPage from './pages/TodayTasksPage';
import LeadsKanbanPage from './pages/LeadsKanbanPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminDashboard from './pages/AdminDashboard';
import LeadPoolPage from './pages/LeadPoolPage';

// New Login & Protection Components
import LoginPage from './pages/AdminLoginPage'; // Using existing admin login page for overall entry
import ProtectedRoute from './components/ProtectedRoute';

function Layout({ children, activePage, mobileOpen, setMobileOpen }) {
  return (
    <div className="crm-layout">
      <Sidebar
        mobileOpen={mobileOpen}
        closeMobile={() => setMobileOpen(false)}
      />
      <div className="crm-main">
        <Navbar
          activePage={activePage}
          openMobile={() => setMobileOpen(true)}
        />
        <main className="crm-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        {/* Entry Login Page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* All CRM Routes are now Protected */}
        <Route path="/" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="dashboard" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><DashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/leads" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="leads" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><LeadsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/kanban" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="kanban" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><LeadsKanbanPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/meetings" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="meetings" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><MeetingsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/todaytasks" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="todaytasks" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><TodayTasksPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="analytics" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><AnalyticsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/whatsapp" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="whatsapp" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><WhatsAppPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="messages" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><MessagesPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="settings" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><SettingsPage /></Layout>
          </ProtectedRoute>
        } />
        
        {/* Dedicated Admin Dashboard — admin only */}
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin={true}>
            <Layout activePage="admin" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><AdminDashboard /></Layout>
          </ProtectedRoute>
        } />

        {/* Lead Pool — accessible by all authenticated users */}
        <Route path="/pool" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="pool" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><LeadPoolPage /></Layout>
          </ProtectedRoute>
        } />

        {/* Fallback to Dashboard/Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

