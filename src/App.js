import { useState, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/AdminLoginPage';

// Critical pages — loaded eagerly so no chunk-download delay on first click
const DashboardPage    = lazy(() => import('./pages/DashboardPage'));
const LeadsPage        = lazy(() => import('./pages/LeadsPage'));

// Secondary pages — lazy loaded (downloaded only when first visited)
const MeetingsPage     = lazy(() => import('./pages/MeetingsPage'));
const WhatsAppPage     = lazy(() => import('./pages/WhatsAppPage'));
const MessagesPage     = lazy(() => import('./pages/MessagesPage'));
const SettingsPage     = lazy(() => import('./pages/SettingsPage'));
const TodayTasksPage   = lazy(() => import('./pages/TodayTasksPage'));
const LeadsKanbanPage  = lazy(() => import('./pages/LeadsKanbanPage'));
const AnalyticsPage    = lazy(() => import('./pages/AnalyticsPage'));
const AdminDashboard   = lazy(() => import('./pages/AdminDashboard'));
const LeadPoolPage          = lazy(() => import('./pages/LeadPoolPage'));
const TeacherSupportPage    = lazy(() => import('./pages/TeacherSupportPage'));

// Prefetch secondary chunks in the background after the app is idle.
// This means by the time the user clicks "Meetings" or "Tasks", the
// JavaScript chunk is already in the browser cache — zero wait time.
function usePrefetchPages() {
  useEffect(() => {
    const id = requestIdleCallback(() => {
      import('./pages/MeetingsPage');
      import('./pages/TodayTasksPage');
      import('./pages/LeadsKanbanPage');
      import('./pages/LeadPoolPage');
      import('./pages/TeacherSupportPage');
    });
    return () => cancelIdleCallback(id);
  }, []);
}

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
  // Kick off background download of secondary page chunks while the user
  // is viewing the dashboard — so navigation is instant when they click.
  usePrefetchPages();

  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#ff6600' }}>Loading…</div>}>
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

        {/* Teacher Support Desk */}
        <Route path="/teacher-support" element={
          <ProtectedRoute requireAdmin={false}>
            <Layout activePage="teacher-support" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}><TeacherSupportPage /></Layout>
          </ProtectedRoute>
        } />

        {/* Fallback to Dashboard/Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

