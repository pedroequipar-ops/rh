import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/common/Navbar'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { LoginPage } from './routes/LoginPage'
import { KanbanPage } from './routes/rh/KanbanPage'
import { VagaFormPage as RhVagaFormPage } from './routes/rh/VagaFormPage'
import { CandidatoFormPage } from './routes/rh/CandidatoFormPage'
import { KanbanReadOnlyPage } from './routes/setor/KanbanReadOnlyPage'
import { VagaFormPage as SetorVagaFormPage } from './routes/setor/VagaFormPage'
import { CandidatoModal } from './components/candidato/CandidatoModal'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto max-w-[1400px]">
        <Outlet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute allowedRoles={['RH']} />}>
            <Route path="/rh/kanban" element={<KanbanPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
            </Route>
            <Route path="/rh/vagas/nova" element={<RhVagaFormPage />} />
            <Route path="/rh/candidatos/novo" element={<CandidatoFormPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SETOR']} />}>
            <Route path="/setor/kanban" element={<KanbanReadOnlyPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
            </Route>
            <Route path="/setor/vagas/nova" element={<SetorVagaFormPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
