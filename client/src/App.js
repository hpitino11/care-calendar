import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Visits from './pages/Visits';
import Caregivers from './pages/Caregivers';
import Clients from './pages/Clients';

function App() {
  return (
    <BrowserRouter>
      <div className="blob blob-top-right" />
      <div className="blob blob-bottom-left" />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/visits" element={<Visits />} />
          <Route path="/caregivers" element={<Caregivers />} />
          <Route path="/clients" element={<Clients />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
