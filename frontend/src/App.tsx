import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/common/AppShell'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { LoginPage } from './routes/LoginPage'
import { MinhasTarefasPage } from './routes/MinhasTarefasPage'
import { RelatorioBuilder } from './routes/RelatorioBuilder'
import { ListagemPage } from './routes/ListagemPage'
import { ConfigLayout } from './routes/config/ConfigLayout'
import { EtapasConfig } from './routes/config/EtapasConfig'
import { SetoresConfig } from './routes/config/SetoresConfig'
import { EmpresaConfig } from './routes/config/EmpresaConfig'
import { CandidatosConfig } from './routes/config/CandidatosConfig'
import { VagasAtivasConfig } from './routes/config/VagasAtivasConfig'
import { TriagemIaConfig } from './routes/config/TriagemIaConfig'
import { VagasBoardPage } from './routes/rh/VagasBoardPage'
import { PessoasBoardPage } from './routes/rh/PessoasBoardPage'
import { VagaFormPage } from './routes/rh/VagaFormPage'
import { CandidatoFormPage } from './routes/rh/CandidatoFormPage'
import { CandidatoModal } from './components/candidato/CandidatoModal'
import { VagaDetalheModal } from './components/vaga/VagaDetalheModal'

// carregado sob demanda: puxa o recharts pra fora do bundle inicial
const DashboardPage = lazy(() =>
  import('./routes/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<div className="p-5 text-sm text-slate-400">Carregando...</div>}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route path="/tarefas" element={<MinhasTarefasPage />} />
          <Route path="/relatorios" element={<RelatorioBuilder />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<ProtectedRoute allowedRoles={['RH']} />}>
            <Route path="/rh/vagas" element={<VagasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
              <Route path="novo-candidato" element={<CandidatoFormPage />} />
            </Route>
            <Route path="/rh/triagem" element={<PessoasBoardPage soTriagem />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
              <Route path="novo-candidato" element={<CandidatoFormPage />} />
            </Route>
            <Route path="/rh/pessoas" element={<PessoasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
              <Route path="novo-candidato" element={<CandidatoFormPage />} />
            </Route>
            <Route path="/rh/kanban/*" element={<Navigate to="/rh/pessoas" replace />} />
            <Route path="/rh/listagem" element={<Navigate to="/config/listagem" replace />} />

            <Route path="/config" element={<ConfigLayout />}>
              <Route index element={<Navigate to="/config/setores" replace />} />
              <Route path="etapas" element={<EtapasConfig />} />
              <Route path="setores" element={<SetoresConfig />} />
              <Route path="usuarios" element={<Navigate to="/config/setores" replace />} />
              <Route path="candidatos" element={<CandidatosConfig />}>
                <Route path="candidato/:id" element={<CandidatoModal />} />
                <Route path="nova-vaga" element={<VagaFormPage />} />
                <Route path="novo-candidato" element={<CandidatoFormPage />} />
              </Route>
              <Route path="vagas-ativas" element={<VagasAtivasConfig />} />
              <Route path="triagem-ia" element={<TriagemIaConfig />} />
              <Route path="empresa" element={<EmpresaConfig />} />
              <Route path="listagem" element={<Navigate to="/config/setores" replace />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SETOR']} />}>
            <Route path="/setor/vagas" element={<VagasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
            </Route>
            <Route path="/setor/triagem" element={<PessoasBoardPage soTriagem />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
            </Route>
            <Route path="/setor/pessoas" element={<PessoasBoardPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
            </Route>
            <Route path="/setor/listagem" element={<ListagemPage />}>
              <Route path="candidato/:id" element={<CandidatoModal />} />
              <Route path="vaga/:id" element={<VagaDetalheModal />} />
              <Route path="nova-vaga" element={<VagaFormPage />} />
            </Route>
            <Route path="/setor/kanban/*" element={<Navigate to="/setor/pessoas" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
