import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import GroupPage from './pages/GroupPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/group/:groupId" element={<GroupPage />} />
      </Routes>
    </AuthProvider>
  );
}
