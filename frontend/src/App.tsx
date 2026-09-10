import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/common/AppShell'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { LoginPage } from './routes/LoginPage'
import { DashboardPage } from './routes/DashboardPage'
import { ListagemPage } from './routes/ListagemPage'
import { VagasBoardPage } from './routes/rh/VagasBoardPage'
import { PessoasBoardPage } from './routes/rh/PessoasBoardPage'
import { VagaFormPage as RhVagaFormPage } from './routes/rh/VagaFormPage'
import { CandidatoFormPage } from './routes/rh/CandidatoFormPage'
import { VagaFormPage as SetorVagaFormPage } from './routes/setor/VagaFormPage'
import { CandidatoModal } from './components/candidato/CandidatoModal'
import { VagaDetalheModal } from './components/vaga/VagaDetalheModal'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<ProtectedRoute allowedRoles={['RH']} />}>
            <Route path="/rh/vagas" element={<VagasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
            <Route path="/rh/pessoas" element={<PessoasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
            <Route path="/rh/vagas/nova" element={<RhVagaFormPage />} />
            <Route path="/rh/candidatos/novo" element={<CandidatoFormPage />} />
            <Route path="/rh/listagem" element={<ListagemPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
            <Route path="/rh/kanban/*" element={<Navigate to="/rh/pessoas" replace />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SETOR']} />}>
            <Route path="/setor/vagas" element={<VagasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
            <Route path="/setor/pessoas" element={<PessoasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
            <Route path="/setor/vagas/nova" element={<SetorVagaFormPage />} />
            <Route path="/setor/listagem" element={<ListagemPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
            </Route>
            <Route path="/setor/kanban/*" element={<Navigate to="/setor/pessoas" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
