# Banco de dados CreateJoy

O arquivo `createjoy.sql` cria uma instalação limpa do sistema. Ele não inclui
alunos, professores, turmas, módulos, missões, medalhas ou entregas fictícias.

## Conteúdo estrutural

Uma instalação nova contém somente:

- os quatro perfis: Aluno, Professor, Supervisão e Admin Geral;
- as permissões padrão desses perfis;
- o catálogo dos níveis Start, Player, Adventure, Geek, Maker, Advanced e Startup;
- o catálogo estrutural da CreateStore com sete produtos e seus preços em Joys;
- três opções educativas de investimento com rendimento simples e baixo;
- as configurações de armazenamento;
- a conta inicial do Admin Geral.

## Grupos de tabelas

### Acesso e segurança

- `users`: login, senha, foto, perfil e situação de acesso;
- `roles`, `permissions`, `role_permissions`: controle de permissões;
- `user_permission_overrides`: exceções de permissão por usuário;
- `password_reset_tokens`: recuperação de senha;
- `audit_logs`: histórico de ações administrativas.

### Organização pedagógica

- `semesters`: semestres e períodos letivos;
- `curriculum_levels`: catálogo dos sete níveis CreateJoy;
- `modules`: módulos efetivamente cadastrados;
- `classes`, `class_schedules`: turmas, dias e horários;
- `class_modules`: módulos vinculados às turmas;
- `class_enrollments`, `student_transfers`: matrícula e histórico de transferências.

### Pessoas

- `students`: dados pedagógicos, gênero, computador, módulo e saldo de Joys;
- `teacher_profiles`: dados complementares dos professores;
- `pedagogical_notes`: observações pedagógicas com autor e visibilidade.

### Jornada e conteúdo

- `missions`: missão, objetivo, aula, ordem, tipo, estado e recompensa;
- `mission_steps`: passo a passo;
- `mission_prerequisites`: regras de bloqueio;
- `mission_support_files`: arquivos de apoio;
- `activities`: exercícios e desafios;
- `activity_prerequisites`: atividade obrigatória que libera cada desafio extra;
- `activity_support_files`: arquivos das atividades;
- `student_missions`: situação da missão para cada aluno;
- `student_activity_progress`: checklist marcado pelo aluno;
- `student_module_completions`: módulos realmente concluídos ou reconhecidos pela gestão;
- `mission_notes`: anotações pessoais do aluno.

### Entregas e arquivos

- `submissions`: histórico completo de tentativas;
- `submission_files`: códigos, STL, PDF e imagens enviados;
- `submission_comments`: comentários e feedbacks;
- os arquivos físicos ficam em `storage/uploads`; o banco guarda metadados e caminho.

### Laboratório e gamificação

- `lab_kits`, `lab_kit_items`: kits e componentes;
- `student_kit_assignments`: kits vinculados aos alunos;
- `student_materials`: materiais pessoais;
- `medals`, `student_medals`: conquistas;
- `joy_transactions`: extrato de Joys.

### CreateStore

- `store_products`: catálogo, imagens, preço em Joys e estoque limitado ou ilimitado;
- `store_purchase_requests`: pedidos dos alunos e análise feita pela Supervisão/Admin;
- uma solicitação pendente não altera o saldo;
- pedidos pendentes reservam a disponibilidade dos produtos limitados, evitando vender além do estoque;
- ao aprovar, o sistema desconta os Joys e grava uma linha em `joy_transactions` na
  mesma transação do banco, impedindo desconto parcial ou duplicado.

### Carteira de Investimentos educativa

- `investment_products`: opções simuladas, símbolo, risco, volatilidade e aporte mínimo;
- `student_investments`: valor investido e quantidade de cotas de cada aluno;
- `investment_transactions`: extrato de aportes e retiradas;
- as cotações são simuladas e mudam uma vez por dia, sem consultar o mercado real;
- o aluno acompanha variações de um dia, sete dias e trinta dias;
- cada aporte compra cotas e cada retirada vende cotas pelo preço simulado do dia;
- o valor pode subir ou cair, e somente Joys inteiros podem ser retirados.

## Instalação

1. Crie um banco MySQL/MariaDB vazio.
2. Selecione o banco no phpMyAdmin.
3. Importe `database/createjoy.sql`.
4. Configure as credenciais em `api/config.local.php`.
5. Entre com `admin@createjoy.com` e a senha temporária `Admin@123`.
6. Altere a senha antes de cadastrar os usuários reais.

Para conferir a instalação local:

```powershell
C:\xampp\php\php.exe database\verify_schema.php
C:\xampp\php\php.exe database\verify_learning_flow.php
C:\xampp\php\php.exe database\verify_store_investments.php
```

O segundo comando cria dados temporários dentro de uma transação, confere as
regras da jornada e desfaz tudo ao final.

## Atualizar uma instalação que já possui dados

Não importe `createjoy.sql` sobre um banco em uso, pois esse arquivo é destinado
a uma instalação nova. Para a atualização de 21/08/2026:

1. exporte um backup completo no phpMyAdmin;
2. selecione o banco atual;
3. importe `database/migrations/2026-08-21-student-learning-flow.sql`;
4. confirme que a versão mais recente em `schema_migrations` é
   `2026.08.21-student-learning-flow`.

Para a atualização de 06/09/2026 em uma instalação que já possui dados:

1. exporte um backup completo no phpMyAdmin;
2. selecione o banco atual;
3. importe somente `database/migrations/2026-09-06-store-investments.sql`;
4. confirme em `schema_migrations` a versão `2026.09.06-store-investments`.

Essa migração é aditiva: acrescenta o estoque, o teclado avulso e as tabelas da
carteira educativa. Ela não apaga alunos, funcionários, turmas, missões,
entregas, pedidos, arquivos ou saldos de Joys.

Para a atualização de 07/09/2026 em uma instalação que já possui dados:

1. exporte um backup completo no phpMyAdmin;
2. selecione o banco atual;
3. importe `database/migrations/2026-09-07-dashboard-analytics.sql`;
4. confirme em `schema_migrations` a versão `2026.09.07-dashboard-analytics`.

Essa migração acrescenta somente o campo opcional de gênero. Os alunos já
cadastrados ficam como **Não informado** até que a Supervisão/Admin edite cada
cadastro. Os indicadores de solicitações e produtos mais vendidos são calculados
diretamente dos pedidos existentes e não duplicam dados.

Para a atualização de 08/09/2026 em uma instalação que já possui dados:

1. exporte um backup completo no phpMyAdmin;
2. selecione o banco atual;
3. importe `database/migrations/2026-09-08-investment-market.sql`;
4. confirme em `schema_migrations` a versão `2026.09.08-investment-market`.

A migração converte o valor dos investimentos existentes em cotas de 100 Joys
na data da atualização. Assim, o total do aluno é preservado antes de começar a
acompanhar as novas oscilações. Ela também inclui Ações de Tecnologia, Energia
Verde e Bitcoin Simulado.

Backups locais gerados antes de migrações ficam em `database/backups` e não são
incluídos no controle de versão.
