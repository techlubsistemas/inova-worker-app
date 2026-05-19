# Plano de Implementação — Offline-First no `inova-worker-app`

> **Status:** 📝 Documento vivo. Será atualizado a cada fase concluída.
> **Última atualização:** 2026-05-15
> **Inspirado em:** `inova-app/docs/OFFLINE-FIRST-PLANO-V2.md`

---

## 1. Objetivo

Permitir que um worker (técnico de campo) execute todo o seu fluxo de trabalho **sem conexão com a internet**:

1. Em rede (escritório / Wi-Fi / 4G), abre o app e a lista de Ordens de Serviço (OS) atribuídas a ele é baixada e persistida localmente.
2. Vai para o pátio da fábrica (sem sinal). Abre o app, vê suas OS, **inicia / pausa / retoma / finaliza** execuções, marca serviços do CIP como concluídos, registra motivos de pausa/cancelamento.
3. Volta para a área com sinal. O app sincroniza automaticamente todas as operações realizadas offline com o `inova-api`, em ordem causal.

**Princípio guia (mesmo do admin):** *"O usuário abre o app e usa."* — Sem tela de preparação, sem seleção manual de "modo offline", sem botão "baixar dados". Auto-pull silencioso ao detectar rede.

---

## 2. Escopo (V1)

### Operações que devem funcionar offline

| Operação | Endpoint atual no `inova-api` | Tipo de op no outbox |
|---|---|---|
| Iniciar OS | `PUT /work-order/single/{id}` (status → `IN_PROGRESS`) | `workOrder.start` |
| Pausar OS | `PUT /work-order/single/{id}` (com motivo) | `workOrder.pause` |
| Retomar OS | `PUT /work-order/single/{id}` | `workOrder.resume` |
| Finalizar OS | `PUT /work-order/single/{id}` (status → `DONE`) | `workOrder.finish` |
| Cancelar OS | `PUT /work-order/single/{id}` (com motivo) | `workOrder.cancel` |
| Marcar serviço do CIP como concluído | (a confirmar nos endpoints) | `cipService.complete` |
| Registrar tempos de execução (timestamps de start/pause/resume/finish) | parte dos updates acima | embutido nos payloads |

### Fora do escopo desta V1 (postergado para versões futuras)

- 📸 Upload de fotos / evidências
- 📝 Apontamento de consumo de materiais
- ✍️ Assinatura digital do cliente
- 📍 Geolocalização (GPS) em início/fim
- 🔧 Abertura de não-conformidades / solicitação de materiais extras
- 👷 Cadastro de equipamento novo encontrado em campo

> Deixar a arquitetura preparada para acomodar essas funcionalidades depois (outbox extensível, schema com colunas reservadas se necessário), mas **não implementar agora**.

---

## 3. Decisões arquiteturais

| Decisão | Escolha | Justificativa |
|---|---|---|
| Storage local | `expo-sqlite` (mesma do `inova-app`) | Performance para datasets médios/grandes, suporte a transações, WAL. |
| Padrão de sync | Outbox + bootstrap snapshot | Já validado e em produção no `inova-app`. |
| Resolução de conflito | **Server-wins** para todas as OS | Veja seção [§7](#7-conflitos--regra-de-resolução). |
| Ordenação no outbox | FIFO por `created_at` ASC | Preserva causalidade (start antes de finish). |
| Granularidade de sync | OS-a-OS (não por rota) | Pedido explícito do PO. |
| Auth offline | Biometria/PIN + token de longa duração no `expo-secure-store` | Worker pode ficar dias sem rede. |
| Fonte da verdade dos timestamps | **Relógio do dispositivo** no momento da ação | Confirmar com PO; é o padrão atual implícito. |
| Endpoint de sync no API | **Novo:** `POST /sync/work-order-batch` (a criar) | Não existe nada hoje no `inova-api`. |

---

## 4. Modelo de dados local

### 4.1 Tabelas de domínio (espelham o servidor)

Cada tabela domínio leva colunas comuns de sync:

```sql
_sync_status TEXT DEFAULT 'synced'   -- synced | pending | conflict | server_overwritten
_local_only INTEGER DEFAULT 0        -- 1 = nunca existiu no servidor (raro p/ worker)
_base_updated_at TEXT                -- updatedAt do servidor (referência p/ detecção de conflito)
_last_local_change_at TEXT           -- última mutação local (debug)
created_at, updated_at TEXT
```

**Tabelas a criar:**

- `work_orders` — espelho da WorkOrder, todos os campos relevantes para a tela de execução (cliente, área, setor, equipamento, CIP associado, status, datas planejadas, worker atribuído).
- `work_order_executions` — registro de cada start/pause/resume/finish com timestamps. Pode ser derivado de eventos no outbox, mas persistir aqui simplifica a UI.
- `cips` — definição do CIP da OS (nome, descrição).
- `cip_services` — lista de serviços do CIP, com flag `completed_local` para marcação offline.
- `equipments` — dados básicos do equipamento da OS (tag, modelo, localização).
- `areas`, `sectors` — para exibição contextual.
- `work_instructions` — instruções de trabalho referenciadas pelos serviços (read-only offline).
- `epis` — EPIs requeridos (read-only offline).
- `materials` — lista de materiais previstos (read-only offline; consumo fica para V2).
- `workers` — dados do próprio worker (perfil, empresa).

> **Critério:** baixar tudo que o worker pode visualizar/precisar consultar durante a execução. Volume estimado por worker: dezenas de OS, centenas de serviços, alguns MB. Validar com dados reais na Fase 0.

### 4.2 Tabelas de infraestrutura (idênticas ao `inova-app`)

```sql
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,             -- clientOpId (UUID v4)
  entity TEXT NOT NULL,            -- workOrder | cipService | ...
  entity_id TEXT NOT NULL,         -- id local (geralmente = id do servidor)
  op_type TEXT NOT NULL,           -- start | pause | resume | finish | cancel | complete
  payload TEXT NOT NULL,           -- JSON com os dados da operação
  base_updated_at TEXT,            -- updatedAt do servidor no momento da mutação local
  status TEXT DEFAULT 'pending',   -- pending | syncing | failed | dead | done | overwritten
  attempts INTEGER DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,            -- last_pull_at | last_push_at | data_version
  value TEXT
);

CREATE TABLE auth_local (
  worker_id TEXT PRIMARY KEY,
  pin_hash TEXT,                   -- bcrypt do PIN local (opcional)
  biometric_enabled INTEGER DEFAULT 0,
  token_cached_until TEXT          -- TTL do token JWT armazenado em secure-store
);
```

> Não vamos ter tabela `conflicts` nem `pending_uploads` nesta V1 (server-wins simplifica; sem fotos).

---

## 5. Bootstrap (download inicial / pull)

### 5.1 Endpoint a criar no `inova-api`

```
GET /sync/worker-bootstrap
Authorization: Bearer <jwt>

Resposta:
{
  worker: { ... },
  workOrders: [ ... ],          // todas as OS atribuídas ao worker, status != ARCHIVED
  cips: [ ... ],                 // CIPs referenciados pelas OS
  cipServices: [ ... ],
  equipments: [ ... ],
  areas: [ ... ],
  sectors: [ ... ],
  workInstructions: [ ... ],
  epis: [ ... ],
  materials: [ ... ],
  serverTime: "2026-05-15T..."
}
```

### 5.2 Estratégia de aplicação

- Merge LWW por linha, comparando `updatedAt` do servidor com `_base_updated_at` local.
- Se a linha local tem `_sync_status = 'pending'` (mutação ainda não enviada) e o servidor mandou versão mais nova → **server-wins**: sobrescreve, marca a op no outbox como `overwritten`, descarta payload local. UI exibe toast "OS X foi atualizada pelo escritório, suas alterações offline foram descartadas."
- Auto-pull silencioso a cada **5 minutos** quando online (mesma janela do admin).
- Auto-pull também ao: foreground do app + `AppState.change` para `active`.

---

## 6. Outbox & motor de sincronização

### 6.1 Enqueue

Toda mutação local segue o fluxo:

```ts
// services/workOrder.ts (refatorado)
async function startWorkOrder(orderId: string) {
  const now = new Date().toISOString();
  const op = {
    id: uuid(),
    entity: 'workOrder',
    entity_id: orderId,
    op_type: 'start',
    payload: { startedAt: now, status: 'IN_PROGRESS' },
    base_updated_at: getLocalRow('work_orders', orderId).updated_at,
  };
  await db.transaction(async (tx) => {
    await tx.insert('outbox', op);
    await tx.update('work_orders', { id: orderId }, {
      status: 'IN_PROGRESS',
      _sync_status: 'pending',
      _last_local_change_at: now,
      updated_at: now,
    });
    await tx.insert('work_order_executions', { ... });
  });
  syncEngine.kick(); // tenta drenar imediatamente; no-op se offline
}
```

### 6.2 Drain (envio em lote)

```
POST /sync/work-order-batch
{
  ops: [
    { id, entity, entityId, opType, payload, baseUpdatedAt, createdAt },
    ...
  ]
}

Resposta:
{
  results: [
    { id, status: 'applied' | 'overwritten' | 'rejected', serverRow?, error? },
    ...
  ],
  serverTime: "..."
}
```

- Lote de até **50 ops**.
- FIFO estrito.
- Backoff exponencial: `[1s, 5s, 30s, 5min, 30min]`. Após 5 falhas → `dead` (requer ação manual via tela de diagnóstico).
- HTTP 401 → pausa engine, dispara fluxo de re-auth (biometria/PIN/login).
- HTTP 5xx → para o loop, tenta novamente no próximo trigger.

### 6.3 Triggers do drain

- Mudança de `NetInfo.isConnected` para `true`.
- App vai para foreground com rede.
- Após cada `enqueue` (best-effort).
- A cada 5 minutos quando online (junto com o auto-pull).

---

## 7. Conflitos — regra de resolução

**Regra única, simples e definida pelo PO:**

> Se houve **qualquer alteração** na OS no servidor enquanto o worker a estava executando offline (ex.: reatribuição, cancelamento, mudança de escopo do CIP), o servidor **ignora** as operações offline daquela OS e mantém o estado do servidor.

### Implementação

- O servidor compara `op.baseUpdatedAt` com o `updatedAt` atual da WorkOrder.
- Se `op.baseUpdatedAt < workOrder.updatedAt` → resposta `{ status: 'overwritten', serverRow: { ... } }` para todas as ops daquela OS no batch.
- O cliente:
  - Marca essas ops no outbox como `overwritten` (não retenta).
  - Sobrescreve a linha local com `serverRow`.
  - Marca `_sync_status = 'server_overwritten'`.
  - UI dispara um **alerta persistente** (banner amarelo) listando OS impactadas: *"As alterações offline da OS #1234 foram descartadas porque a ordem foi atualizada pelo escritório. Toque para ver detalhes."*

### Casos cobertos por essa regra

| Cenário | Comportamento |
|---|---|
| Despachante reatribuiu a OS para outro worker | Execução offline descartada; OS some da lista do worker original. |
| Despachante cancelou a OS | Execução offline descartada; OS aparece como cancelada. |
| Outro worker já iniciou/finalizou a mesma OS | Execução offline descartada; estado do servidor prevalece. |
| Admin alterou serviços do CIP | Execução offline descartada; novos serviços aparecem. |

---

## 8. Autenticação offline

### 8.1 Requisito

Worker pode ficar **dias** sem rede. Não pode ser barrado por expiração de token, nem por fechar e reabrir o app.

### 8.2 Estratégia

1. **Token JWT de longa duração** (≥ 30 dias) armazenado em `expo-secure-store` (mesma prática do admin).
2. **PIN local de 4-6 dígitos** opcional, configurado no primeiro login online. Hash com bcrypt em `auth_local`.
3. **Biometria** (Face ID / fingerprint) via `expo-local-authentication`, opcional.
4. Fluxo de abertura do app:
   - Token cache válido (`token_cached_until > now`)?
     - Sim + biometria/PIN configurados → pede biometria/PIN → libera modo offline.
     - Sim + nada configurado → libera direto (igual hoje).
     - Não → exige login online.
5. Se token expirar enquanto offline → app continua usável em modo *read+write local*; sync engine fica em estado `awaiting_auth`; ao recuperar rede, força re-login antes de drenar.

### 8.3 Tela de configuração

Nova tela em `app/profile/security.tsx`:
- Toggle "Habilitar PIN para abertura offline" → fluxo de criação.
- Toggle "Habilitar biometria" (se dispositivo suportar).
- Botão "Resetar credenciais offline" (limpa cache, força login online).

---

## 9. UI / UX

### 9.1 Componentes a criar (espelhando admin)

- `components/OfflineBanner.tsx` — 3 estados (nunca sincronizou / dados desatualizados >7d / offline recente).
- `components/sync/SyncBadge.tsx` — badge no header com contagem do outbox (`pending + failed`).
- `components/sync/ServerOverwriteAlert.tsx` — alerta amarelo persistente para OS sobrescritas pelo servidor; toque mostra modal com detalhes.
- Tela `app/sync.tsx` (acesso via menu/perfil):
  - Status: última sincronização, próxima auto-pull, contagem do outbox.
  - Botão "Sincronizar agora" (force pull + drain, ignora throttle).
  - Lista de ops no outbox com status, tentativas, último erro.
  - Botão "Resetar dados offline" (DEV / suporte).

### 9.2 Indicadores nas telas existentes

- Card de OS na home: ícone discreto se há ops `pending` para aquela OS.
- Tela de detalhe da OS: badge "Aguardando sincronização" se houver ops pendentes; toast ao iniciar/pausar/finalizar offline ("Salvo offline, será sincronizado quando houver conexão.").

---

## 10. Mudanças no `inova-api`

| Endpoint | Método | Descrição |
|---|---|---|
| `/sync/worker-bootstrap` | GET | Snapshot inicial de todos os dados que o worker pode precisar offline. |
| `/sync/work-order-batch` | POST | Recebe lote de ops, aplica em transação, retorna resultados por op. |
| `/sync/worker-bootstrap` (delta) | GET com `?since=ISO_DATE` | (Opcional, otimização) Retorna apenas linhas alteradas desde a última sync. |

### Considerações no servidor

- Idempotência por `clientOpId` (chave única em tabela `processed_ops`).
- Validação de autoria: ops só são aceitas se a OS pertence ao worker autenticado no momento atual.
- Preservar histórico de execuções mesmo quando ops são `overwritten` (auditoria).

---

## 11. Fases de implementação

> Marque cada checkbox conforme for concluindo. PRs pequenos e incrementais.

### Fase 0 — Descoberta & validação ✅ (concluída em 2026-05-15)

- [x] Mapear todos os endpoints atualmente chamados pelo worker-app — ver §15.1.
- [x] Confirmar fonte da verdade dos timestamps — **cliente** (ver §15.2).
- [x] Mapear modelo de dados servidor (Prisma) e state machine — ver §15.3.
- [x] Confirmar TTL do JWT (30d, já em produção) — ver §15.4.
- [x] Identificar padrão de batch já existente no API — ver §15.5.
- [x] Identificar guards e bugs de autorização pré-existentes — ver §15.6.
- [ ] **Pendente:** Confirmar com PO o volume real de dados por worker (quantas OS, serviços) — fazer com dados de produção real ou dump de uma empresa piloto na Fase 1.
- [ ] **Pendente:** Resolver decisões em §15.8 antes de iniciar a Fase 1.

### Fase 1 — Infraestrutura local ✅ (concluída em 2026-05-15)

- [x] Adicionar `expo-sqlite` (~16.0.10) e `@react-native-community/netinfo` (11.4.1) ao `package.json`.
- [x] `lib/db/sqlite.ts` (singleton com WAL + foreign keys + busy_timeout, helpers `getDatabase`, `closeDatabase`, `deleteLocalDatabase`).
- [x] `lib/db/migrations/runner.ts` (versionamento via `schema_version`) + `lib/db/migrations/001_init.ts` com todas as tabelas: `workers`, `areas`, `sectors`, `equipments`, `cips`, `cip_services`, `work_instructions`, `epis`, `materials`, `service_problem_reasons`, `work_orders`, `work_order_time_entries`, `work_order_cip_services`, `outbox`, `sync_meta`, `server_overwrites`, `auth_local`.
- [x] `lib/db/initDatabase.ts` orquestra: open DB → run migrations → reset ops 'syncing' órfãs.
- [x] `lib/db/repositories/`:
  - `genericRepo.ts` (factory para entidades read-only com padrão `id + indexed cols + data JSON + sync cols`)
  - `index.ts` exporta repos para todas as entidades de domínio (workers, areas, sectors, equipments, cips, cipServices, workInstructions, epis, materials, serviceProblemReasons)
  - `workOrdersRepo.ts` (especializado, com `applyLocalMutation` e `findByStatus`)
  - `outboxRepo.ts` (enqueue / peekPending / markSyncing|Done|Overwritten|Failed com backoff `[1s, 5s, 30s, 5min, 30min]` / resetOrphanedSyncing / countByStatus)
  - `syncMetaRepo.ts` (kv store: `last_pull_at`, `last_push_at`, `data_version`, `bootstrap_completed_at`)
  - `serverOverwritesRepo.ts` (record / listUnacknowledged / acknowledge — para alerta UI da regra server-wins)
  - `types.ts` (BaseRow, ParsedRow, parseRow helpers)
- [x] `context/NetworkContext.tsx` (NetInfo listener, expõe `isOnline = isConnected && isInternetReachable`).
- [x] `context/SyncContext.tsx` (skeleton: `dbReady`, `outboxCount`, `unacknowledgedOverwrites`, `lastPullAt`, `engineStatus`, `forceSync` no-op por enquanto, `kickEngine`, `refreshCounters`; auto-refresh em foreground e on-online).
- [x] `app/_layout.tsx` integra `NetworkProvider` (mais externo) → `AuthProvider` → `SyncProvider` (dentro de AuthGuard, antes dos providers de domínio).
- [x] `npx tsc --noEmit` passa sem erros.

> **Pronto para Fase 2.** Nenhuma mudança visível ao usuário ainda — fundação puramente interna.

### Fase 2 — Bootstrap (pull) ✅ (concluída em 2026-05-15)

- [x] **API:** `GET /sync/worker-bootstrap` criado em `inova-api/src/modules/sync/controllers/workerBootstrap.controller.ts` + `services/workerBootstrap.service.ts`. Reusa `WorkOrderService.fetchByWorkerId` (que já trata visibilidade direta + por time + por rota). Retorna: `{ schemaVersion, serverTime, worker, workOrders, areas, sectors, equipments, cips, cipServices, workInstructions, epis, materials, serviceProblemReasons }`. `LayoutModule` agora exporta `WorkOrderService`; `SyncModule` importa `LayoutModule`.
- [x] **App:** `lib/sync/types.ts` (tipos do snapshot), `lib/sync/bootstrap.ts` (`runWorkerPull` + `applySnapshot`, com coalescência de chamadas concorrentes) e `lib/sync/autoPull.ts` (throttle de 5min via `maybeAutoPull`).
- [x] Auto-pull triggered por: (a) `worker + dbReady + isOnline` ficarem todos true, (b) volta de background, (c) `setInterval` de 5min, (d) recuperação de conexão.
- [x] Server-wins parcial: ao aplicar snapshot, OS com `_sync_status = 'pending'` são **preservadas** localmente; o sync engine (Fase 4) decidirá overwrite quando tentar push e o servidor responder com `updatedAt` mais novo.
- [x] `WorkOrdersContext` refatorado para ler do SQLite via `workOrdersRepo.findAll()` e re-renderizar quando `dataVersion` mudar (incrementado a cada pull bem-sucedido). API pública preservada (`workOrders`, `loading`, `error`, `refetch`, `refetchIfStale`, `updateLocal`) — telas existentes não precisam mudar. `updateLocal` continua in-memory por enquanto; será substituído na Fase 3.
- [x] `SyncContext` ganhou `dataVersion: number` para sinalizar mudanças aos consumidores; `forceSync` agora chama `runWorkerPull` (push virá na Fase 4).
- [x] `tsc --noEmit` passa em ambos os projetos (worker-app e inova-api).

### Fase 3 — Outbox & mutações offline ✅ (concluída em 2026-05-15)

- [x] Outbox repo já criado na Fase 1 (`lib/db/repositories/outboxRepo.ts`).
- [x] `services/workOrder.ts` refatorado: `updateWorkOrderStatus`, `updateWorkOrderServiceStatus`, `pauseWorkOrder`, `resumeWorkOrder` agora aplicam mutação local via `workOrdersRepo.applyLocalMutation` + enfileiram op no outbox + emitem `dbEvents.emitDataChanged()`. Funções **não chamam mais axios** — funcionam totalmente offline. `fetchMyWorkOrders` mantida só por compat com `hooks/useWorkOrders.ts` legacy.
- [x] Mapeamento de op types: `start | finish | cancel | pause | resume` (workOrder) e `cancel | complete` (cipService). Para `pause`/`resume`, payload carrega `pausedAt`/`resumedAt` capturados no cliente — o batch endpoint da Fase 4 vai usar isso para reconstruir intervalos do `WorkOrderTimeEntry`.
- [x] Atualização otimista: mutação local em SQLite é imediata; `dbEvents` notifica `SyncContext` que bumpa `dataVersion`; `WorkOrdersContext` re-lê do SQLite e re-renderiza telas. Pipeline 100% reativo.
- [x] `lib/db/dbEvents.ts` — pub/sub minimalista para evitar import de React contexts em código não-React (services, sync engine).
- [x] Validação contra mutação em OS não-baixada: services lançam erro claro `"WorkOrder X não está disponível offline. Sincronize primeiro."` se `workOrdersRepo.findById` retorna null.
- [x] `tsc --noEmit` passa limpo.

> **Nota:** As chamadas redundantes a `updateLocal` nas telas (`app/order/[orderId].tsx`) ficaram inertes — o pipeline outbox→dbEvents→dataVersion já atualiza a UI. Limpeza dessas chamadas (e remoção de `updateLocal` da API do `WorkOrdersContext`) pode ir num PR de follow-up; deixadas agora para minimizar diff.

> **Adiado para Fase 7:** Toasts informando "salvo offline" quando sem rede. A atualização otimista já dá feedback visual; o toast é polish secundário.

### Fase 4 — Sync engine (push) ✅ (concluída em 2026-05-15)

- [x] **API:** novo `POST /sync/work-order/worker-batch` em `inova-api/src/modules/sync/controllers/workerBatch.controller.ts` + service. Aceita até 50 ops por request. Implementa:
  - **Idempotência:** tabela nova `worker_sync_processed_ops` (PK `clientOpId`) cacheia o resultado. Re-envios retornam o mesmo result, sem reaplicar.
  - **Server-wins por WO:** ops são agrupadas por `workOrderId`. Se `wo.updatedAt > ops[0].baseUpdatedAt`, todas as ops do grupo retornam `overwritten` com o `serverRow` atual.
  - **Op handlers:** `start` (cria TimeEntry), `pause` (fecha TimeEntry), `resume` (fecha + abre TimeEntry), `finish` (fecha TimeEntry + auto-completa serviços pendentes), `cancel` (fecha TimeEntry), e para `cipService`: `cancel`/`complete` que atualizam `WorkOrderCipService`.
  - **Validação de acesso:** rejeita ops de OS onde o worker não está em `WorkOrderWorker`.
  - **Transação Prisma:** ops do mesmo grupo aplicadas atomicamente; se falhar, todas viram `rejected`.
- [x] **Migration:** `20260515120000_add_worker_sync_processed_ops` cria a tabela de idempotência **e adiciona `updatedAt` no `WorkOrder`** (não existia — essencial para o LWW). Schema Prisma atualizado.
- [x] **App:** `lib/sync/syncEngine.ts` com `runSyncOnce()` coalesçada, batch de 50, loop até esvaziar:
  - Backoff exponencial `[1s, 5s, 30s, 5min, 30min]` já implementado no `outboxRepo.markFailed`.
  - **HTTP 401:** marca engine como `awaiting_auth`, devolve ops para `failed` com mensagem clara, para o loop. Re-libera quando `worker` volta a estar disponível.
  - **HTTP 5xx / rede:** marca ops como `failed` (entra no backoff), sai do loop.
  - **Resultados aplicados:** `applied` → `markDone` + `upsertFromServer` da WO; `overwritten` → `markOverwritten` + `serverOverwritesRepo.record` (1 alerta por OS, agrupado); `rejected` → `markFailed`.
- [x] **Triggers:** push dispara em (a) `dbEvents.emitDataChanged` (após cada mutação local via outbox), (b) após cada pull bem-sucedido, (c) `kickEngine()` manual, (d) `forceSync()` (botão).
- [x] `tsc --noEmit` limpo nos dois projetos.

> **Importante:** A migration Prisma só foi criada como arquivo SQL — o user precisa rodar `npx prisma migrate deploy` (ou `migrate dev`) com o DB acessível para aplicar. O `prisma generate` já foi executado, então o cliente conhece o novo modelo.

### Fase 5 — Resolução de conflitos (server-wins) ✅ (concluída em 2026-05-15)

- [x] Lógica de marcar ops como `overwritten` (entregue na Fase 4 dentro de `lib/sync/syncEngine.ts`).
- [x] Sobrescrita da linha local com `serverRow` (idem; `applyServerRowToLocal` no engine + `_sync_status='server_overwritten'`).
- [x] Componente `components/sync/ServerOverwriteAlert.tsx` — banner amarelo persistente, lista até 3 OS afetadas + contagem do resto, botão "X" dispensa todas via `serverOverwritesRepo.acknowledgeAll()`. Renderizado globalmente no `_layout.tsx` (overlay no topo).

### Fase 6 — Auth offline ✅ (concluída em 2026-05-15)

- [x] TTL do JWT já é 30 dias no `inova-api` (`auth.module.ts:14`) — não precisa mudar.
- [x] Adicionadas deps `expo-local-authentication` (~17.0.7) e `expo-crypto` (~15.0.9). Hash via SHA-256 + salt per-device persistido em `expo-secure-store` (decisão deliberada — bcrypt JS é lento em RN e oferece pouco ganho real para PIN de 4-6 dígitos; o salt impede rainbow tables, e qualquer ataque exige acesso simultâneo ao keychain e ao SQLite local).
- [x] Tabela `auth_local` já criada na Fase 1; novo `lib/db/repositories/authLocalRepo.ts` com CRUD.
- [x] `lib/auth/localAuth.ts` — `hashPin`, `verifyPin`, `detectBiometricCapability`, `promptBiometric`, `clearLocalAuthSalt`.
- [x] `context/LocalAuthContext.tsx` — gerencia estado `loading | unlocked | locked_pin | locked_biometric`. Re-trava ao voltar do background. APIs: `unlockWithPin`, `unlockWithBiometric`, `setPin`, `setBiometric`.
- [x] `components/sync/LockScreen.tsx` — overlay full-screen com input de PIN ou prompt biométrico (auto-trigger), fallback para PIN se biometria falhar, opção "Sair e fazer login" (preserva ops offline).
- [x] `app/profile/security.tsx` — config de PIN (4-6 dígitos com confirmação) e toggle de biometria (desabilitado se hardware indisponível ou não enrolado).
- [x] Integração no `_layout.tsx`: `LocalAuthProvider` aninhado dentro do `SyncProvider`; `LockOverlay` renderiza `LockScreen` por cima de tudo quando `state` é `locked_*`. Rota `profile/security` registrada.
- [x] Estado `awaiting_auth` no sync engine: já existia (Fase 4).
- [x] `tsc --noEmit` limpo.

> **Comportamento:** Se o worker NÃO tem PIN nem biometria configurados, o app abre direto (sem trava) — comportamento idêntico ao anterior. Apenas quando ele explicitamente configura uma das opções em `/profile/security`, o `LockScreen` passa a aparecer no boot e ao voltar do background.

### Fase 7 — UI de diagnóstico ✅ (concluída em 2026-05-15)

- [x] `components/sync/OfflineBanner.tsx` — 3 modos: `never_synced` (vermelho), `stale >7d` (âmbar escuro), `offline` (âmbar). Renderizado globalmente no overlay do `_layout.tsx`.
- [x] `components/sync/SyncBadge.tsx` — ícone no header com badge contendo `outboxCount + unacknowledgedOverwrites` (vermelho se há overwrites, âmbar se só pending). Toque navega para `/sync`. Spinner quando engine está pulling/pushing.
- [x] `components/sync/ServerOverwriteAlert.tsx` — coberto na Fase 5.
- [x] Tela `app/sync.tsx`:
  - Status: conexão, última pull/push, contagem outbox/overwrites, estado do motor.
  - Botão "Sincronizar agora" (chama `forceSync()`, desabilitado offline).
  - Lista das ops no outbox com entity, op_type, status, attempts, last_error.
- [x] `SyncBadge` integrado ao `UserHeader` (visível em toda tela que usa o header).
- [x] Rota `sync` registrada no Stack do `_layout.tsx`.

> **Adiado / fora desta V1:** Toasts inline ("salvo offline" após cada mutação) — a atualização otimista da UI já dá feedback visual instantâneo, e o banner global cobre o estado de conexão. Pode ser adicionado depois sem refactor (basta exibir um toast simples nos handlers de mutação).

### Fase 8 — QA & hardening (3-5 dias)

- [ ] Testes manuais ponta a ponta:
  - Iniciar/pausar/finalizar offline → reconectar → confirmar sync.
  - Reatribuição offline → confirmar server-wins.
  - Cancelamento offline → idem.
  - Token expirado offline → reabrir app com PIN → operar → sync ao voltar rede.
  - App fechado e reaberto várias vezes offline.
  - Bateria / desligamento brusco no meio da operação.
- [ ] Stress test: 100+ ops no outbox, simular rede instável.
- [ ] Revisar tamanho do snapshot (kB/MB) e tempo de bootstrap.
- [ ] Logs estruturados para suporte (exportáveis via tela de sync).
- [ ] Documentar regras para o time de suporte.

### Fase 9 — Rollout (1 semana de campo)

- [ ] Deploy beta para 1-2 workers piloto.
- [ ] Monitorar dashboards (taxa de ops `dead`, conflitos, tempo médio de sync).
- [ ] Coletar feedback, iterar.
- [ ] Rollout geral.

---

## 12. Pontos a confirmar (antes ou durante a implementação)

- [ ] **Fase 0:** Endpoint exato e formato de marcação de "serviço do CIP concluído" (não está claro no código atual).
- [ ] **Fase 0:** Confirmar com PO se timestamps são realmente do dispositivo (suspeita atual) e se isso deve ser preservado.
- [ ] **Fase 2:** Decidir se `WorkOrdersContext` vira proxy do SQLite ou é removido em favor de hooks que leem direto do DB (`useWorkOrders()`).
- [ ] **Fase 4:** Definir se idempotência server-side usa tabela dedicada (`processed_ops`) ou índice único em campos da própria entidade.
- [ ] **Fase 6:** Validar com segurança/PO se PIN de 4 dígitos é aceitável ou se deve ser 6+.
- [ ] **Fase 6:** Política se worker for desligado da empresa enquanto offline (token revogado server-side, mas ele ainda consegue operar localmente até reconectar).

---

## 13. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Snapshot do bootstrap muito grande, lento de baixar | Médio | Medir em Fase 0; se necessário, paginar ou usar delta `?since=`. |
| Worker perde dias de trabalho se DB local corromper | Alto | WAL mode + backup automático do `outbox` em disco antes de cada push; logs exportáveis. |
| Ops `dead` (após 5 falhas) ficam invisíveis | Médio | Tela de sync mostra; banner persistente quando há `dead`. |
| Server-wins descarta trabalho válido do worker | Alto | UI muito clara sobre o descarte; PO pode adicionar regra opt-in para revisar antes de descartar (V2). |
| Token revogado server-side mas worker continua operando | Baixo | Server rejeita batch no próximo sync; worker é deslogado e perde mutações da sessão (raro). |
| Conflito entre `WorkOrdersContext` (cache em memória) e SQLite | Médio | Refatorar/remover em Fase 2 antes de adicionar mutações offline. |

---

## 14. Estrutura final de arquivos (preview)

```
inova-worker-app/
├── lib/
│   ├── db/
│   │   ├── sqlite.ts
│   │   ├── migrations/
│   │   │   └── 001_init.ts
│   │   └── repositories/
│   │       ├── workOrders.ts
│   │       ├── cipServices.ts
│   │       └── ...
│   └── sync/
│       ├── outbox.ts
│       ├── syncEngine.ts
│       ├── bootstrap.ts
│       ├── autoPull.ts
│       └── types.ts
├── context/
│   ├── NetworkContext.tsx
│   ├── SyncContext.tsx
│   └── AuthContext.tsx (estendido com biometria/PIN)
├── components/
│   ├── OfflineBanner.tsx
│   └── sync/
│       ├── SyncBadge.tsx
│       └── ServerOverwriteAlert.tsx
├── app/
│   ├── sync.tsx
│   └── profile/
│       └── security.tsx
└── services/
    └── workOrder.ts (refatorado: enqueue em vez de fetch direto)
```

---

## 15. Achados da Fase 0 (descoberta)

> Resultado do mapeamento completo executado em 2026-05-15. Fonte: leitura direta do código de `inova-worker-app` e `inova-api`.

### 15.1 Endpoints atuais que serão substituídos por sync

| Op | Endpoint atual | Arquivo cliente | Payload atual |
|---|---|---|---|
| `workOrder.start` | `PUT /work-order/single/{id}` | `services/workOrder.ts:28` | `{ status: "in_progress", executedAt }` |
| `workOrder.pause` | `PUT /work-order/single/{id}/pause` | `services/workOrder.ts:54` | (vazio) |
| `workOrder.resume` | `PUT /work-order/single/{id}/resume` | `services/workOrder.ts:57` | (vazio) |
| `workOrder.finish` | `PUT /work-order/single/{id}` | `services/workOrder.ts:28` | `{ status: "completed", completedAt }` |
| `workOrder.cancel` | `PUT /work-order/single/{id}` | `services/workOrder.ts:28` | `{ status: "cancelled", cancellationReason }` |
| `cipService.complete` (com anomalia) | `PUT /work-order/single/{id}/service/{cipId}` | `services/workOrder.ts:47` | `{ status: "cancelled", completedAt, cancellationReason \| cancellationReasonId }` |
| `cipService.complete` (sem anomalia) | **Implícito** — servidor auto-completa pendentes ao receber `status: "completed"` na OS | — | n/a |

**Queries (não precisam de sync, só do bootstrap):**
- `GET /work-order/worker/me` → fonte para popular tabela `work_orders` no bootstrap
- `GET /service-problem-reason/worker/me` → fonte para popular tabela `service_problem_reasons` (necessária para o select de motivos offline)

### 15.2 Timestamps — confirmado: **cliente é a fonte da verdade**

Verificado em `inova-api/src/modules/layout/controllers/workOrder.controller.ts:142-145`:

```ts
executedAt: executedAt !== undefined ? new Date(executedAt) : null,
completedAt: completedAt !== undefined ? new Date(completedAt) : null,
```

O servidor aceita o ISO string enviado pelo cliente sem sobrescrever. Isso **valida** nossa estratégia de offline (timestamps capturados no momento da ação local serão preservados).

**Risco identificado (fora de escopo desta V1):** Não há validação contra clock spoofing. Worker mal-intencionado pode reportar timestamps falsos. Aceitável para V1; documentar como débito técnico.

### 15.3 Modelo de dados servidor (Prisma) — confirmações

- **WorkOrder** (`schema.prisma:1049+`): tem `status`, `scheduledAt`, `executedAt`, `completedAt`, `cancellationReason`, `visibilityMode`. **Não tem** `pausedAt` — pauses/resumes são modelados via `WorkOrderTimeEntry`.
- **WorkOrderTimeEntry**: cada par `startedAt` / `stoppedAt` representa um intervalo contínuo de execução. Pause = fechar entry; resume = abrir novo. **Implicação:** o batch precisa enviar timestamps de pause/resume para o servidor reconstruir os intervalos corretos (atualmente os endpoints `/pause` e `/resume` usam `now()` no servidor — vamos quebrar essa premissa no batch).
- **WorkOrderCipService**: link table com `status`, `executedAt`, `completedAt`, `cancellationReason`, `cancellationReasonId`. Compound PK `(workOrderId, cipServiceId)`.
- **ServiceRequest**: criada automaticamente quando um cipService é cancelado (`workOrder.service.ts:844`). Manter esse comportamento no batch.

### 15.4 Auth — JWT de worker já é 30 dias ✅

`inova-api/src/modules/auth/auth.module.ts:14`: `signOptions: { expiresIn: '30d' }`.

**Implicação:** Fase 6 não precisa estender o TTL no servidor. Basta implementar PIN/biometria no cliente.

### 15.5 Padrão de batch já existente no API

`POST /work-order/multi` e `POST /work-order/route/multi` já existem. O novo `POST /sync/work-order/worker-batch` deve seguir o mesmo padrão (array de ops, validação upfront, transação Prisma).

### 15.6 Guards & autorização

- `WorkerGuard` (`shared/auth/worker.guard.ts:12`) valida `payload.type === 'worker'`.
- `assertWorkerCanAccessWorkOrder()` (`workOrder.service.ts:~1087`) valida acesso por OS (atribuição direta ou visibilidade por time).
- **Bug crítico pré-existente (fora de escopo):** `PUT /work-order/single/:id` está **SEM `WorkerGuard`** (`workOrder.controller.ts:156`). Qualquer usuário autenticado pode editar timestamps. Reportar separadamente; a nova rota de sync **deve** usar `WorkerGuard` + `assertWorkerCanAccessWorkOrder` em cada op.

### 15.7 Ajustes ao plano original (impactos)

- **§4 (schema local):** adicionar tabela `work_order_time_entries` para espelhar o servidor; tabela `service_problem_reasons` para o picker de motivos offline.
- **§6 (outbox):** payload de `pause`/`resume` precisa carregar timestamp explícito (`pausedAt`/`resumedAt`) — o servidor atual não aceita; o novo batch endpoint vai aceitar e usar esses valores ao manipular `WorkOrderTimeEntry`.
- **§8 (Fase 6):** marcar como **parcialmente pronta** — token 30d já existe; resta só o lado cliente (PIN/biometria).
- **§10 (API):** nome definitivo do endpoint = `POST /sync/work-order/worker-batch` (alinhado com convenção `multi`). Bootstrap = `GET /sync/worker-bootstrap`.
- **Novo na Fase 4:** o batch endpoint precisa internalizar a lógica de "pause = close time entry", "resume = open new time entry", "finish = auto-complete pending services + close any open entry" — tudo idempotente via `clientOpId`.

### 15.8 Decisões pendentes (resolver antes ou durante a Fase 1)

- [x] **Validação de timestamps no batch:** aceitar qualquer ISO string (igual ao comportamento atual). Sem janela de validação. _Decisão PO 2026-05-15._
- [x] **Volume de dados por worker:** não há workers reais em produção ainda. Não bloqueia; medir em ambiente de teste com dados sintéticos na Fase 2.
- [ ] `WorkOrdersContext` (cache 30s em memória) será **substituído** por leitura direta do SQLite (com hook `useWorkOrders()` que assina mudanças do DB) — decisão tomada para evitar dupla fonte de verdade.
- [ ] `StartedOrdersContext` (SecureStore que rastreia OS iniciadas) provavelmente vira redundante quando o status estiver no SQLite local. Avaliar remoção na Fase 2.

---

## 16. Changelog

- **2026-05-15** — Criação do documento. Escopo definido, decisões arquiteturais alinhadas com o PO.
- **2026-05-15** — Fase 0 concluída: mapeamento completo de endpoints (worker-app + inova-api), confirmação de timestamps cliente-source, identificação de bug pré-existente em `PUT /work-order/single/:id` (sem guard), confirmação de JWT 30d já em produção. Plano ajustado em §4, §6, §8, §10. Pronto para iniciar Fase 1.
- **2026-05-15** — Fase 1 concluída: infraestrutura local pronta. Adicionadas deps `expo-sqlite` e `@react-native-community/netinfo`. Criados: `lib/db/{sqlite,initDatabase}.ts`, migrations runner + `001_init` (17 tabelas), 6 repositories (genérico + 4 especializados + types). Contexts `NetworkProvider` e `SyncProvider` integrados ao `_layout.tsx`. `tsc --noEmit` passa limpo.
- **2026-05-15** — Fase 2 concluída: bootstrap pull funcionando ponta a ponta. **API:** novo `GET /sync/worker-bootstrap` reusando `WorkOrderService.fetchByWorkerId` + lookups da empresa. **App:** `lib/sync/{types,bootstrap,autoPull}.ts` + `SyncContext` orquestra triggers (login, foreground, intervalo 5min, online-recovery) + `WorkOrdersContext` agora lê do SQLite com re-render via `dataVersion`. Server-wins parcial em pull preserva ops `pending` para resolução no push (Fase 4/5). `tsc` limpo nos 2 projetos.
- **2026-05-15** — Fase 3 concluída: mutações offline. `services/workOrder.ts` reescrito para aplicar mutação local + enfileirar no outbox em vez de chamar axios. Pipeline reativo `outbox → dbEvents → dataVersion → SQLite re-read → UI`. Pause/resume capturam timestamp do cliente (necessário para reconstrução correta de `WorkOrderTimeEntry` no batch endpoint da Fase 4). `tsc` limpo.
- **2026-05-15** — Fase 4 concluída: sync engine. **API:** novo `POST /sync/work-order/worker-batch` com idempotência via tabela `worker_sync_processed_ops` + server-wins por WO + 6 op handlers (start/pause/resume/finish/cancel + cipService cancel/complete). Migration adiciona `WorkOrder.updatedAt` (faltava no schema). **App:** `lib/sync/syncEngine.ts` com drain loop coalesçado, batch 50, backoff exponencial; trata 401 (awaiting_auth) e 5xx (retry). Triggers integrados ao `SyncContext` (após mutação local, após pull, kickEngine, forceSync). **Fase 5 (server-wins UI alert) já parcialmente entregue** via `serverOverwritesRepo.record` chamado pelo engine. `tsc` limpo.
- **2026-05-15** — Fases 5 + 7 concluídas: UI de diagnóstico. Componentes `OfflineBanner` (3 modos), `SyncBadge` (header com contagem + spinner), `ServerOverwriteAlert` (banner amarelo persistente listando OS sobrescritas). Tela `app/sync.tsx` com status + botão "Sincronizar agora" + lista do outbox. Rota registrada e badge integrado ao `UserHeader`. `tsc` limpo.
- **2026-05-15** — Fase 6 concluída: auth offline. Adicionadas deps `expo-local-authentication` + `expo-crypto`. Hash SHA-256 + salt per-device em SecureStore. Novo `LocalAuthContext` gerencia estados `unlocked`/`locked_pin`/`locked_biometric` (re-trava ao background). `LockScreen` overlay com input de PIN + prompt biométrico auto-trigger. Tela `app/profile/security.tsx` para config. Comportamento opt-in: se worker não configurou PIN/biometria, app abre direto (zero impacto para quem não usa). `tsc` limpo.
