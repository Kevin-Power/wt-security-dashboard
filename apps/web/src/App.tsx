import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout';
import { ProtectedRoute } from './components/auth';
import { 
  Dashboard, 
  KB4Page, 
  NCMPage, 
  EDRPage, 
  HIBPPage, 
  TrendsPage,
  LoginPage,
} from './pages';
import { initializeAuth } from './stores/authStore';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  // Initialize auth on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/kb4" element={<KB4Page />} />
        <Route path="/ncm" element={<NCMPage />} />
        <Route path="/edr" element={<EDRPage />} />
        <Route path="/hibp" element={<HIBPPage />} />
        <Route path="/trends" element={<TrendsPage />} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
