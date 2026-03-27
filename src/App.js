import { useState } from 'react';
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

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage setActivePage={setActivePage} />;
      case 'leads':     return <LeadsPage />;
      case 'meetings':  return <MeetingsPage />;
      case 'whatsapp':  return <WhatsAppPage />;
      case 'messages':  return <MessagesPage />;
      case 'todaytasks': return <TodayTasksPage />;
      case 'kanban':     return <LeadsKanbanPage />;
      case 'analytics':  return <AnalyticsPage />;
      case 'settings':  return <SettingsPage />;
      default:          return <DashboardPage setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="crm-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        mobileOpen={mobileOpen}
        closeMobile={() => setMobileOpen(false)}
      />
      <div className="crm-main">
        <Navbar
          activePage={activePage}
          openMobile={() => setMobileOpen(true)}
        />
        <main className="crm-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;

