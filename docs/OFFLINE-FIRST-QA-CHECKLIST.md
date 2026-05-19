# Checklist de QA — Offline-First do `inova-worker-app`

> Use este documento para validar a V1 ponta a ponta.
> Marque cada `[ ]` conforme for testando.
> Setup esperado: backend em `:3334`, túnel Cloudflare, Expo Go no celular conectado ao túnel.

---

## ⚠️ Antes de começar — Pré-requisitos

- [ ] **Migration aplicada em produção** (`npx prisma migrate status` mostra "up to date")
- [ ] **Worker de teste** existe no banco (com CPF + senha conhecidos)
- [ ] **Pelo menos 2 OS atribuídas** ao worker de teste (idealmente uma OS solta + uma de rota)
- [ ] **Acesso ao painel admin** (`inova-app`) para simular ações do despachante
- [ ] **Acesso ao banco** (psql / pgAdmin / DBeaver) para inspeção rápida quando necessário

> ⚠️ **Atenção sobre Expo Go:** o app agora usa 4 módulos nativos (`expo-sqlite`, `@react-native-community/netinfo`, `expo-local-authentication`, `expo-crypto`). Todos são compatíveis com Expo Go SDK 54, mas se algum não funcionar, será necessário um **dev client** (`eas build --profile development`).

---

## 1. Smoke test (sanidade básica)

- [ ] App abre sem crash na home
- [ ] Console do Metro (`expo start`) mostra log do tipo `[db] migrations aplicadas: 0 → 1 (1)` no primeiro boot
- [ ] Login com CPF/senha funciona
- [ ] Após login, a Home mostra a lista de OS atribuídas

**Validação no banco:**
- [ ] Verificar que o arquivo SQLite foi criado no dispositivo (não tem como inspecionar diretamente sem ferramenta extra; basta confirmar que a Home renderiza dados)

---

## 2. Bootstrap — pull inicial

- [ ] Após login online, **abrir a tela `/sync`** (toque no ícone de nuvem no canto superior direito do header — só aparece se há outbox; se não há, navegue digitando manualmente ou aguarde até ter algo no outbox)
- [ ] Em `/sync`, "Última sincronização" mostra "agora" ou "X min atrás"
- [ ] "Pendentes no envio" = 0
- [ ] "OS sobrescritas pelo servidor" = 0
- [ ] "Estado do motor" = "Ocioso"

**Comportamento esperado em background:**
- [ ] Sair do app por mais de 1 min e voltar → pull dispara silenciosamente (verificar logs do Metro)
- [ ] Aguardar 5 min com app em foreground → pull dispara automaticamente

---

## 3. Offline read-only

- [ ] **Desligar Wi-Fi e dados móveis do celular**
- [ ] Banner "Sem conexão" (âmbar) aparece no topo
- [ ] Home continua mostrando a lista de OS (lendo do SQLite)
- [ ] Tocar em uma OS abre o detalhe normalmente, com todos os serviços do CIP visíveis
- [ ] Tocar em "Reportar anomalia" em um serviço abre o modal com a lista de motivos pré-baixados

---

## 4. Mutações offline

> Mantenha o celular **offline** durante este bloco.

### 4.1 Iniciar OS
- [ ] Abrir uma OS pendente, tocar "Iniciar"
- [ ] Status muda imediatamente para "Em andamento" (otimismo da UI)
- [ ] Voltar para Home → o card da OS mostra status atualizado
- [ ] Badge no header (ícone de nuvem) aparece com "1" (1 op no outbox)

### 4.2 Pausar
- [ ] Tocar "Pausar"
- [ ] Status vira "Pausada" imediatamente
- [ ] Badge no header agora mostra "2"

### 4.3 Retomar
- [ ] Tocar "Retomar"
- [ ] Status volta para "Em andamento"
- [ ] Badge mostra "3"

### 4.4 Reportar anomalia em um serviço
- [ ] Entrar num serviço do CIP, tocar "Reportar anomalia"
- [ ] Selecionar motivo + escrever observação, salvar
- [ ] Voltar e ver o serviço marcado com badge de problema/cancelamento
- [ ] Badge no header agora mostra "4"

### 4.5 Concluir OS
- [ ] Voltar para a OS, tocar "Concluir"
- [ ] Status vira "Concluída"
- [ ] Badge mostra "5"

### 4.6 Verificação no banco local (opcional, requer ferramenta)
- [ ] Não há jeito fácil sem dev client — pular ou usar `npx expo run:android` para inspecionar via debugger

---

## 5. Push — sincronização ao reconectar

- [ ] **Religar Wi-Fi/dados móveis**
- [ ] Banner de "Sem conexão" desaparece em segundos
- [ ] Badge no header começa girando (spinner) ou troca para o ícone de upload
- [ ] Em ~10 segundos, badge desaparece (= outbox vazio)
- [ ] Abrir `/sync` → "Pendentes no envio" = 0, "Último envio" = "agora"

**Validação no banco (produção):**
- [ ] Conectar ao painel admin do `inova-app`
- [ ] Abrir a OS que você pausou/retomou/finalizou
- [ ] Conferir status final = "Concluída"
- [ ] Conferir histórico de execução (`WorkOrderTimeEntry`) tem **start + pause + resume + finish** com timestamps **do momento offline** (não do momento da sync)
- [ ] Conferir o serviço que foi marcado com anomalia tem `cancellationReason` preenchido

**SQL útil:**
```sql
SELECT id, status, "executedAt", "completedAt", "updatedAt"
FROM work_orders WHERE id = '<id-da-OS>';

SELECT * FROM work_order_time_entries WHERE "workOrderId" = '<id-da-OS>'
ORDER BY "startedAt";

SELECT * FROM worker_sync_processed_ops
WHERE "workerId" = '<id-do-worker>' ORDER BY "appliedAt" DESC LIMIT 20;
```

---

## 6. Conflito server-wins

> Cenário: worker está offline operando uma OS, e o despachante altera a mesma OS pelo painel.

- [ ] Worker abre a OS no celular, fica **offline**, inicia execução (status muda para "Em andamento" localmente)
- [ ] **No painel admin** (`inova-app`), abrir a mesma OS e cancelá-la (ou alterar qualquer campo, como observação)
- [ ] Worker pausa e finaliza a OS offline (mais 2 ops no outbox)
- [ ] Religar internet do celular
- [ ] Sync dispara, e:
  - [ ] **Banner amarelo** aparece no topo: "1 OS foi atualizada pelo escritório"
  - [ ] OS na home reflete o estado do servidor (cancelada, no nosso exemplo) — **não** o estado offline do worker
  - [ ] Badge no header: contagem mostra a quantidade de overwrites pendentes (vermelho)
- [ ] Tocar no "X" do banner → banner some
- [ ] Em `/sync`, "OS sobrescritas pelo servidor" volta a 0

**Validação no banco:**
- [ ] `worker_sync_processed_ops` tem entradas com `result.status = "overwritten"` para essas ops
- [ ] `WorkOrderTimeEntry` da OS afetada **não** tem os entries que o worker tentou criar offline (servidor descartou)

---

## 7. Token expirado / 401

> Difícil de simular sem mexer no DB. Pulável no V1 — só verificar que a UI tem fallback.

**Simulação manual:**
- [ ] No banco, achar o token JWT do worker (não há like — mas se mudar `JWT_SECRET` no `.env` e reiniciar API, todos os tokens viram inválidos)
- [ ] Worker tenta uma operação online → API responde 401
- [ ] Engine entra em estado `awaiting_auth` (ver em `/sync` → "Estado do motor")
- [ ] App não desloga automaticamente (axios interceptor desloga via `signOut` do AuthContext — pode causar comportamento misto; observar)

> Se isso for problema, ajuste o interceptor para não deslogar quando há ops pendentes no outbox (V1.1).

---

## 8. PIN e biometria (Fase 6)

- [ ] Navegar para `/profile/security` (não há link no menu ainda — digitar manualmente o path no Expo Go ou adicionar atalho)

### 8.1 PIN
- [ ] Configurar PIN de 4 dígitos (ex.: 1234)
- [ ] Confirmação coincide → "PIN configurado" mostrado
- [ ] **Fechar o app** (swipe da lista de apps recentes)
- [ ] Abrir o app de novo → `LockScreen` aparece pedindo PIN
- [ ] Digitar PIN errado → "PIN incorreto"
- [ ] Digitar PIN certo → desbloqueia
- [ ] Mandar app para background (botão home), voltar → trava de novo
- [ ] Voltar em `/profile/security`, "Remover PIN" → confirma → não trava mais

### 8.2 Biometria (em device com fingerprint/Face ID)
- [ ] Ativar toggle "Biometria"
- [ ] Fechar e reabrir o app → prompt biométrico aparece automaticamente
- [ ] Cancelar prompt → fallback para PIN (se PIN também estiver configurado) ou mostra "Tentar novamente"
- [ ] Aprovar prompt → desbloqueia

### 8.3 Sem device biométrico (Expo Go no emulador, por exemplo)
- [ ] Toggle "Biometria" deve aparecer **desabilitado** com texto "Indisponível neste dispositivo"

---

## 9. Edge cases / hardening

### 9.1 Idempotência (re-envio de batch)
- [ ] Forçar uma situação onde o app envia o batch, recebe sucesso, mas perde a resposta (difícil sem ferramenta — pular ou simular com Charles Proxy / mitm)
- [ ] Alternativa: criar uma op offline, religar internet, e antes do sync completar, tirar internet de novo. Religar. Verificar que a op aplica **uma vez só** no servidor.

### 9.2 Badge atualiza em real time
- [ ] Iniciar uma OS offline → badge incrementa imediatamente (sem refresh)
- [ ] Concluir sync → badge desaparece automaticamente

### 9.3 Refresh manual
- [ ] Em `/sync`, tocar "Sincronizar agora" online → ciclo dispara, contadores atualizam
- [ ] Tocar "Sincronizar agora" offline → botão fica desabilitado

### 9.4 Pull-to-refresh na home
- [ ] Puxar lista de OS para baixo → trigger de refresh visual + chama `forceSync` em background
- [ ] Lista atualiza com dados mais recentes do servidor (se houver)

### 9.5 App fechado durante o sync
- [ ] Iniciar sync, fechar o app durante o envio
- [ ] Reabrir → `outboxRepo.resetOrphanedSyncing` deve ter rolado (log: `[db] resetadas X ops 'syncing' órfãs para 'pending'`)
- [ ] Sync recomeça normalmente

### 9.6 Múltiplas ops na mesma OS (FIFO)
- [ ] Offline, fazer start → pause → resume → finish na mesma OS (4 ops)
- [ ] Religar
- [ ] No banco, `WorkOrderTimeEntry` deve ter os intervalos corretos (start1→pause, resume→finish), não bagunçados

### 9.7 OS removida do escopo do worker
- [ ] No painel, desatribuir uma OS do worker
- [ ] Próximo pull no app → OS some da Home (server snapshot não trouxe ela; mas atualmente o app não DELETA OS removidas — apenas as preserva localmente. **Possível débito técnico para V1.1**: limpar OS órfãs após pull)

---

## 10. Bugs/observações conhecidas (já identificadas)

- ⚠️ **`PUT /work-order/single/:id` sem `WorkerGuard`** no `inova-api` — bug pré-existente, não relacionado à Fase de offline mas deve ser tratado em PR separado.
- ⚠️ **OS órfãs não são removidas** do SQLite quando deixam de existir/de pertencer ao worker (item 9.7) — listar para V1.1.
- ⚠️ **Sem link visível** para `/profile/security` no menu — adicionar à navegação principal em V1.1.
- ⚠️ **Sem toast "salvo offline"** — atualização otimista da UI já dá feedback, mas um toast explícito seria melhor UX.

---

## Resultado final

- [ ] Todos os blocos 1-6 passam → V1 está pronta para piloto com 1-2 workers reais
- [ ] Bloco 7 (token expirado) tem comportamento aceitável
- [ ] Bloco 8 (PIN/biometria) opcional mas idealmente verificado em pelo menos 1 device físico
- [ ] Bloco 9 (edge cases) — itens críticos validados (9.2, 9.4, 9.5, 9.6)

**Decisão de rollout:** _______________________________________________
