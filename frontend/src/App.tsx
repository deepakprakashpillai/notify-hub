import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import ApplicationDetail from './pages/ApplicationDetail';
import Workflows from './pages/Workflows';
import Monitoring from './pages/Monitoring';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="applications" element={<Applications />} />
          <Route path="applications/:appId" element={<ApplicationDetail />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="monitoring" element={<Monitoring />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
