# Especificação do App Worker – Inova

Documento de referência para o desenvolvimento da nova versão do **inova-worker-app**. Descreve o que deve conter e como implementar as funcionalidades, alinhado ao sistema administrativo (inova-adm) e ao backend (inova-api). A estrutura atual do app é apenas uma sugestão; os fluxos podem e devem ser alterados para refletir a realidade atual.

---

## 1. Objetivo e público

- **Público:** exclusivamente **workers** (técnicos/operadores de campo).
- **Papel do app:** permitir que o worker visualize as **Ordens de Serviço (Work Orders)** que pode executar, inicie a execução e só encerre quando todos os serviços da ordem forem realizados com sucesso **ou** quando um problema for relatado (quando não for possível executar o serviço).

---

## 2. Regras de acesso às Work Orders (visibilidade)

O worker só enxerga ordens de serviço conforme a configuração feita no sistema adm:

| Situação | O que o worker vê |
|----------|--------------------|
| **Ordem atribuída a um funcionário específico** (programador definiu quem executa) | Apenas o worker **atribuído** vê essa ordem (via `workOrderWorkers` / `visibilityMode: assigned_workers`). |
| **Ordem sem atribuição específica** | Todos os workers que possuem a **função** exigida pelo serviço veem a ordem. O vínculo é por **função**: no cadastro do serviço define-se a equipe (team) com suas funções (workerRoles); no cadastro do worker define-se as funções que ele possui; workers cujas funções pertencem à equipe do serviço veem a ordem. |
| **Worker sem nenhuma equipe/função vinculada** | Todas as ordens da empresa (companyId do worker), exceto as atribuídas exclusivamente a outros workers. |

**Implementação no backend:**

- Endpoint `GET /work-order/worker/me` (protegido por WorkerGuard):
  1. **(a)** Retorna WOs em que o worker está em `workOrderWorkers` (atribuído a ele), respeitando companyId.
  2. **(b)** Retorna WOs **sem** workers atribuídos cujo `CipService.teamId` está nos times do worker (derivados das funções do worker via WorkerRole → TeamWorkerRole → Team) e mesma empresa.
  3. Se o worker não tiver times: retorna (a) + todas as demais WOs da empresa (sem duplicar as já atribuídas a ele).

**Modelo de dados (resumo):**

- **Worker** → `companyId`; funções (WorkerRole) via WorkerWorkerRole; times derivados via TeamWorkerRole.
- **CipService** → `teamId` (equipe/função necessária); cada **WorkOrder** está ligada a um `cipServiceId`.
- **WorkOrder** → `routeId` (opcional), `visibilityMode`, `workOrderWorkers` (quando atribuída), `status`.

---

## 3. Conceito: Ordem de serviço e serviços

- **Ordem de serviço:** container que pode ter **um ou mais serviços**. No app, cada card na lista é uma “ordem de serviço” (seja uma rota com N WOs, seja um WO sozinho = ordem de 1 serviço).
- **Serviço:** unidade executável dentro da ordem; no modelo atual da API, cada **WorkOrder** corresponde a um serviço (1 WO = 1 CipService).
- O worker **inicia** a ordem (um “check” na tela da ordem) e só pode **finalizar** a ordem quando **todos** os serviços estiverem concluídos ou com problema/feedback registrado. Ele executa **um serviço por vez**: abre o serviço (tela do WO), conclui ou relata problema, volta à lista dos serviços da ordem e repete.

## 4. Fluxo principal do worker

### 4.1 Listagem

- Após o login, o worker vê uma **lista de ordens de serviço** (conforme regras do item 2), obtida via `GET /work-order/worker/me`.
- Abas por status: **A Fazer**, **Em andamento**, **Concluídas**.
- Cada item é uma “Ordem de serviço” (com 1 ou N serviços). Toque leva à **tela da ordem**.

### 4.2 Tela da ordem (iniciar ordem → lista de serviços)

- **Ordem com vários serviços (rota):** tela `route/[routeId]`. Título “Ordem de serviço”, nome da rota, quantidade de serviços.
- **Ordem de um serviço:** tela `order/[orderId]`. Título “Ordem de serviço”, 1 serviço.
- O worker deve **iniciar a execução da ordem** (botão “Iniciar execução da ordem”). Isso desbloqueia a lista de serviços (estado “ordem iniciada” é persistido localmente).
- Após iniciar, é exibida a **lista de serviços** da ordem. Toque em um serviço abre o **detalhe do WO** (tela do serviço).

### 4.3 Tela do serviço (WO) – executar um serviço

- O worker **inicia a execução** do serviço (WO) na API: `PUT /work-order/single/:workOrderId` com `status: 'in_progress'` e `executedAt` (ISO).
- Em seguida pode **concluir com sucesso** (`status: 'completed'`, `completedAt`) ou **relatar problema** (fluxo “Relatar problema”, ex.: `status: 'cancelled'` + motivo).
- Após concluir ou relatar, volta à **lista de serviços da ordem**. Só quando **todos** os serviços tiverem conclusão ou justificativa aparece o botão **“Concluir ordem”** na tela da ordem.

### 4.4 Proteção de acesso

- Serviço (WO) que pertence a uma **rota:** só pode ser aberto se a ordem (rota) tiver sido iniciada; caso contrário o app exibe mensagem e botão “Ir para a ordem”.
- Serviço (WO) que é **ordem de 1 serviço:** só pode ser executado se a ordem tiver sido iniciada na tela `order/[orderId]`; acesso direto ao WO sem iniciar a ordem exibe “Ordem de serviço não iniciada” e “Ir para a ordem”.

---

## 5. Modelo atual no backend (referência)

- **WorkOrder:** `id`, `cipServiceId`, `routeId?`, `status`, `scheduledAt`, `executedAt`, `completedAt`, relação com `CipService` e `Route`.
- **WorkOrderStatus (enum):** `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`.
- **CipService:** contém `teamId` (equipe responsável); ligado a CIP, modelo de serviço, equipamento (via CIP → subset → set → equipment), etc.
- **Worker:** `companyId`; associação a **Team** via **WorkerTeam**.
- **Rotas:** `Route` tem muitas `WorkOrder`; uma WO pode ou não estar em uma rota (`routeId` opcional).

Endpoints atuais relevantes:

- `POST /auth/worker/login` – login (CPF, senha); retorna `access_token` e dados do worker.
- `POST /auth/worker/first-access` – primeiro acesso (definir senha).
- `GET /work-order/route/:routeId` – WOs por rota (uso adm).
- `GET /work-order/company/:companyId` – WOs por empresa (uso adm, exige JWT compatível).
- `PUT /work-order/single/:workOrderId` – atualizar status/datas da WO (status, scheduledAt, executedAt, completedAt).
- `POST /work-order/filter` – filtrar WOs (companyId, routeId, teamIds, etc.) – uso adm.

O endpoint `GET /work-order/worker/me` implementa a regra de visibilidade (atribuído + função/time) conforme item 2.

---

## 6. O que implementar no app (checklist)

### 6.1 Autenticação (já existente, eventual ajuste)

- [ ] Manter login por CPF e senha (`POST /auth/worker/login`) e primeiro acesso (`POST /auth/worker/first-access`).
- [ ] Garantir que o token e o `companyId` (e, se o backend retornar, `workerId`) estejam disponíveis no contexto do app para todas as chamadas que listam ou alteram Work Orders.
- [ ] Se o backend passar a retornar `teamIds` no payload do worker no login, o app pode usar para cache/local; a regra de negócio de “quais WOs mostrar” deve ficar no backend.

### 6.2 Listagem de ordens de serviço

- [x] Chamada à API `GET /work-order/worker/me`.
- [x] Tratar estados de loading e erro (sem ordens, falha de rede, 401).
- [x] Exibir lista de **ordens de serviço** (cards: ordem com N serviços = rota; ordem com 1 serviço = WO individual). Abas A Fazer, Em andamento, Concluídas. Ordenação por data (atrasada/mais antiga primeiro).
- [x] Toque no card leva à tela da ordem (`route/[routeId]` ou `order/[orderId]`), não diretamente ao WO.

### 6.3 Tela da ordem e fluxo único (iniciar ordem → serviços → concluir ordem)

- [x] Tela da ordem (rota ou ordem de 1 serviço): título “Ordem de serviço”, botão “Iniciar execução da ordem” (estado persistido localmente), lista de serviços (cada um = 1 WO). Toque no serviço abre a tela do WO.
- [x] “Concluir ordem” só é exibido quando **todos** os serviços da ordem estiverem com status concluído ou cancelado (com justificativa).

### 6.4 Detalhe do serviço (WO) – conclusão com sucesso

- [x] Na tela do WO: botão “Iniciar execução” (chama `PUT /work-order/single/:workOrderId` com `status: 'in_progress'`, `executedAt`).
- [x] Botão “Concluir com sucesso”: `PUT` com `status: 'completed'` e `completedAt` (ISO).

### 6.5 Relatar problema

- [x] Fluxo “Relatar problema”: tela com campo obrigatório de descrição; ao confirmar, atualização da WO (ex.: `status: 'cancelled'` e motivo).

### 6.6 Navegação e fluxo geral

- [x] Fluxo: **Home → Lista de ordens de serviço → Tela da ordem (iniciar ordem) → Lista de serviços → Tela do serviço (WO) → Concluir/Relatar → Volta à ordem → Concluir ordem** quando todos os serviços fechados.
- [x] Estado “ordens iniciadas” em `StartedOrdersContext` (persistido em SecureStore). Proteção: WO de rota ou de ordem single só acessível após iniciar a ordem.

### 6.7 Experiência do usuário

- [ ] Feedback visual claro por status (pendente, em andamento, concluída, cancelada/com problema).
- [ ] Mensagens de erro amigáveis (sem token, rede indisponível, WO já concluída por outro, etc.).
- [ ] Se fizer sentido, manter funcionalidades como “Inova University” ou banners desde que não conflitem com o novo fluxo.

---

## 7. Backend – resumo

- **Endpoint “minhas Work Orders”:** `GET /work-order/worker/me` aplica visibilidade por (a) atribuição (`workOrderWorkers` contém o worker) e (b) função/time (WOs sem atribuição e `CipService.teamId` nos times do worker). Worker sem times vê (a) + demais WOs da empresa.
- **Proteção:** WorkerGuard (JWT `type: 'worker'`).
- **Relatar problema:** app envia `status: 'cancelled'` e `cancellationReason` (ou equivalente) no `PUT /work-order/single/:workOrderId`.

---

## 8. Sistema adm (inova-adm) – premissas

- O administrador da empresa **vincula workers a equipes (teams)** quando deseja que o worker veja apenas WOs daquelas equipes.
- Se o worker não for vinculado a nenhuma equipe, o app (via backend) deve considerar “empresa toda” para listar WOs.
- O adm continua criando/planejando rotas e work orders; o app worker apenas consome e atualiza status/datas conforme este documento.

---

## 9. Estrutura atual do app

A estrutura atual do **inova-worker-app** (pastas `app/`, `context/`, `components/`, telas como `home`, `routes`, `routeEquipment`, `startedRoute`) foi concebida como prova de conceito. Para a nova versão:

- **Mantenha** o que fizer sentido (login, primeiro acesso, contexto de autenticação, componentes de UI reutilizáveis).
- **Substitua** o conceito de “rotas” mock por **listagem e execução de Work Orders** vindas da API.
- **Renomeie/reorganize** telas se necessário (ex.: lista de WOs no lugar da lista de “rotas”, detalhe/execução de WO no lugar de “routeEquipment”/“startedRoute”) para refletir a nomenclatura do backend e a experiência do worker.

Este documento pode ser usado como contexto em um novo chat Cursor para implementar a nova versão do app worker e os ajustes necessários no backend.
