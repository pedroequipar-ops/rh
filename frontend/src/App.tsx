import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/common/Navbar'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { LoginPage } from './routes/LoginPage'
import { ListagemPage } from './routes/ListagemPage'
import { KanbanPage } from './routes/rh/KanbanPage'
import { VagaFormPage as RhVagaFormPage } from './routes/rh/VagaFormPage'
import { CandidatoFormPage } from './routes/rh/CandidatoFormPage'
import { KanbanReadOnlyPage } from './routes/setor/KanbanReadOnlyPage'
import { VagaFormPage as SetorVagaFormPage } from './routes/setor/VagaFormPage'
import { CandidatoModal } from './components/candidato/CandidatoModal'
import { VagaDetalheModal } from './components/vaga/VagaDetalheModal'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Outlet />
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
            <Route path="/rh/candidatos/:id/editar" element={<CandidatoFormPage />} />
            <Route path="/rh/listagem" element={<ListagemPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SETOR']} />}>
            <Route path="/setor/kanban" element={<KanbanReadOnlyPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
            </Route>
            <Route path="/setor/vagas/nova" element={<SetorVagaFormPage />} />
            <Route path="/setor/listagem" element={<ListagemPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
