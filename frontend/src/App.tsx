import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth-store'
import ProtectedRoute from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout'
import ErrorBoundary from '@/components/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import TaskDetailPage from '@/pages/TaskDetailPage'

function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProjectsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProjectsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProjectDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/tasks/:taskId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <TaskDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
