# Publicação do CreateJoy na HostGator

O projeto usa apenas HTML, CSS, JavaScript, PHP 8 e MySQL/MariaDB. Não é
necessário executar Vite, Node.js, Composer ou qualquer processo em segundo
plano na hospedagem.

## 1. Criar o banco

1. No cPanel, abra **Bancos de dados MySQL**.
2. Crie um banco e um usuário.
3. Associe o usuário ao banco com **todos os privilégios**.
4. No phpMyAdmin, selecione o banco e importe `database/createjoy.sql`.

A importação cria as 46 tabelas e somente os dados estruturais do sistema.
Não são criados alunos, professores, turmas, módulos, missões ou entregas de
demonstração.

Entre os dados estruturais está o catálogo da CreateStore: bala (1 Joy), caixa
de bombons (300 Joys), impressão 3D personalizada (300 Joys), mouse gamer
(1.500 Joys), headset gamer (2.500 Joys) e kit mouse e teclado gamer
(3.000 Joys). O aluno solicita na CreateStore e somente a aprovação da
Supervisão/Admin efetua o desconto e registra a movimentação.

Os nomes do banco e do usuário costumam receber o prefixo da conta do cPanel,
por exemplo `conta_createjoy`.

## 2. Configurar a conexão

Faça uma cópia de `api/config.local.example.php` com o nome
`api/config.local.php` e informe:

```php
'host' => 'localhost',
'port' => '3306',
'name' => 'PREFIXO_createjoy',
'user' => 'PREFIXO_usuario',
'password' => 'SENHA_DO_BANCO',
```

## 3. Enviar os arquivos

Envie todo o conteúdo deste diretório para `public_html` pelo Gerenciador de
Arquivos ou FTP. Confirme que `storage/uploads` e `storage/sessions` existem.
Normalmente a permissão `0750` ou `0755` é suficiente para o PHP gravar os
uploads e manter o login entre as páginas.

O arquivo `.htaccess` bloqueia acesso direto a configurações, SQL e uploads.
Os downloads são entregues pela API somente após conferir a sessão do usuário.
Ao enviar os arquivos, confirme que os arquivos ocultos `.htaccess` também
foram incluídos.

Em um subdomínio, envie esses arquivos diretamente para a pasta raiz definida
para o subdomínio. A pasta vazia `public` não é necessária e pode ser omitida.

## Atualizar sem perder os dados atuais

Para uma hospedagem que já está em uso, **não importe `database/createjoy.sql`**.
Esse arquivo recria uma instalação limpa. Faça assim:

1. no phpMyAdmin, exporte um backup completo do banco atual;
2. ainda no banco atual, importe somente
   `database/migrations/2026-08-21-student-learning-flow.sql`;
3. envie novamente `api`, `js`, `images/store`, `images/brand`, `styles.css` e
   `index.html` para a raiz do subdomínio;
4. preserve o `api/config.local.php` que já está funcionando na hospedagem;
5. acesse o endpoint de saúde e faça login para conferir a atualização.

A migração de 21/08/2026 é aditiva: cria o checklist, o registro real de módulos
concluídos e as dependências de atividades, além de apontar o catálogo para as
novas imagens. Ela não exclui cadastros, entregas, uploads nem saldos de Joys.

### Atualização da área do professor — 24/08/2026

O pacote `ATUALIZACAO-PROFESSOR-2026-08-24.zip` atualiza somente arquivos do
sistema. Ele não possui SQL, não recria tabelas e não inclui
`api/config.local.php`. Extraia-o diretamente na raiz atual do subdomínio e
confirme a substituição dos arquivos. Os dados já cadastrados permanecem no
banco existente.

### Medalhas e conquistas — 24/08/2026

O pacote `ATUALIZACAO-MEDALHAS-2026-08-24.zip` também atualiza somente os
arquivos do sistema. Ele não contém SQL e não inclui `api/config.local.php`.
Depois de extrair o pacote na raiz do subdomínio, entre como Supervisão ou
Admin, abra **Medalhas** e clique uma vez em **Cadastrar medalhas e conquistas**.

O carregamento utiliza as tabelas `medals` e `student_medals` que já existem e
faz somente inserções que ainda não existem. Alunos, turmas, módulos, missões,
entregas, arquivos e saldos atuais não são apagados nem substituídos. Sempre
que um novo módulo for criado, use **Atualizar catálogo** para gerar as medalhas
específicas daquele curso.

### Pacote cumulativo da interface — 24/08/2026

O arquivo `ATUALIZACAO-COMPLETA-2026-08-24-v3.zip` reúne as atualizações da
área do professor, medalhas/conquistas, central de notificações, novos popups,
correção do progresso e páginas de perfil. Extraia o conteúdo diretamente na
raiz atual do subdomínio e confirme a substituição dos arquivos.

Esse pacote não contém SQL, `api/config.local.php`, uploads nem imagens já
enviadas pelos usuários. Portanto, não recria o banco e não apaga cadastros,
entregas, arquivos ou saldos. Antes de atualizar, mantenha o backup normal do
banco e não exclua as pastas `storage` e `images` existentes na hospedagem.

### Gestão, estoque e carteira educativa — 06/09/2026

O pacote `ATUALIZACAO-COMPLETA-2026-09-06.zip` reúne as telas e correções
anteriores mais: acompanhamento e correção pela gestão, movimentação de Joys,
paginação e filtros, exclusão definitiva opcional de alunos, fotos de perfil,
catálogo administrável com estoque, teclado avulso e Carteira de Investimentos.

Esta versão precisa de uma migração aditiva. Faça backup e importe somente
`database/migrations/2026-09-06-store-investments.sql` no banco existente.
Nunca importe `database/createjoy.sql` sobre a instalação em uso.

Depois, extraia o pacote na raiz do subdomínio e confirme a substituição dos
arquivos. O pacote não contém `api/config.local.php`, `storage` nem as imagens
personalizadas já enviadas pelos usuários. Portanto, preserve essas pastas na
hospedagem. Instruções detalhadas estão em
`ATUALIZACAO-HOSTGATOR-2026-09-06.md`.

### Indicadores do dashboard — 07/09/2026

O pacote `ATUALIZACAO-COMPLETA-2026-09-07.zip` é cumulativo e acrescenta ao
dashboard da Supervisão/Admin os gráficos de alunos por gênero, situação das
solicitações da CreateStore e ranking dos produtos mais vendidos. O cadastro e
a edição de alunos também passam a aceitar gênero.

Faça backup e importe somente
`database/migrations/2026-09-07-dashboard-analytics.sql` no banco existente.
Essa migração acrescenta um campo opcional e não modifica os valores dos alunos
já cadastrados; eles ficam como **Não informado** até serem editados.

Depois, extraia o pacote na raiz do subdomínio e confirme a substituição. Não
importe `database/createjoy.sql` e preserve `api/config.local.php`, `storage` e
as imagens atuais. O passo a passo completo está em
`ATUALIZACAO-HOSTGATOR-2026-09-07.md`.

### Mercado educativo — 08/09/2026

O pacote `ATUALIZACAO-COMPLETA-2026-09-08.zip` acrescenta seis opções de
investimento com cotações simuladas e oscilações diárias, incluindo Bitcoin
Simulado, Ações de Tecnologia e Energia Verde. Os alunos acompanham as mudanças
de um dia, sete dias e trinta dias e podem investir ou retirar Joys inteiros.

Faça backup e importe
`database/migrations/2026-09-08-investment-market.sql`. Investimentos antigos
são convertidos em cotas sem reduzir o valor disponível no momento da migração.
As cotações são educativas e não consultam preços reais.

### Persistência da carteira e das fotos — 10/09/2026

O pacote `ATUALIZACAO-CREATEJOY-2026-09-10.zip` corrige os botões de investir e
retirar, mantém o saldo confirmado pelo banco ao trocar de página e mostra o
rendimento da posição separado das variações de 1, 7 e 30 dias do gráfico.
O rendimento diário considera somente as cotas que já existiam antes da
cotação do dia; compras feitas hoje começam com rendimento zero.

As novas fotos de perfil ficam em `storage/avatars` e são exibidas por uma rota
protegida da API. Isso evita fotos quebradas por permissões da pasta pública e
preserva os arquivos nas próximas atualizações.

Esta atualização não possui SQL. Extraia o ZIP na raiz do subdomínio, confirme
a substituição dos arquivos e preserve `api/config.local.php` e toda a pasta
`storage`.

## 4. Testar

Acesse:

`https://seu-dominio.com/api/index.php?route=health`

O retorno esperado é:

```json
{"ok":true,"message":"API e banco de dados estão funcionando."}
```

Conta inicial:

- Admin Geral: `admin@createjoy.com` / `Admin@123`

Troque a senha temporária no primeiro acesso. Os demais usuários devem ser
cadastrados pelo painel.

Na área de gestão, o menu **Administração** concentra semestres, medalhas,
laboratório, materiais pessoais, pré-requisitos, arquivos de apoio, observações
pedagógicas e auditoria. A auditoria é exibida somente para contas com a
permissão `audit.view`.

## Limites de upload

O sistema aceita até 3 arquivos por tentativa, 5 MB por arquivo e 8 MB no total.
Imagens podem ter no máximo 1,5 MB. Caso a HostGator esteja configurada com
limites menores, ajuste no cPanel:

- `upload_max_filesize`
- `post_max_size`
- `max_file_uploads`

O `post_max_size` precisa ser maior que a soma dos arquivos enviados.
