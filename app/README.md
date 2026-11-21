# Sistema CreateJoy

Sistema web da CreateJoy para gestão de alunos, turmas, missões, Joys, loja, investimentos educativos, contratos e rematrículas.

## Requisitos

- PHP 8.1 ou superior
- MySQL 5.7 ou superior
- Servidor Apache com `mod_rewrite`

## Instalação limpa

1. Crie um banco de dados MySQL vazio.
2. Importe `database/createjoy.sql`.
3. Copie `api/config.local.example.php` para `api/config.local.php`.
4. Preencha as credenciais do banco no arquivo local.
5. Envie o conteúdo deste repositório para a raiz do domínio ou subdomínio.
6. Garanta permissão de escrita em `storage/uploads`, `storage/sessions` e `storage/avatars`.

O arquivo `api/config.local.php` não é versionado. A instalação limpa cria somente a conta administrativa inicial documentada em `README-HOSTGATOR.md` e exige alteração de senha no primeiro acesso.

## Atualização de uma instalação existente

Não importe `database/createjoy.sql` sobre um banco já utilizado. Faça backup e aplique somente as migrações ainda não executadas, na ordem indicada em `database/migrations`.

A migração de rematrícula incluída neste repositório cria a estrutura e registros em branco para os alunos existentes. Dados históricos importados de planilhas não fazem parte do repositório por privacidade.

## Dados privados

O repositório não inclui:

- credenciais de banco;
- sessões e arquivos enviados pelos usuários;
- fotos de perfil;
- backups do banco;
- cadastros reais de alunos, responsáveis ou contratos;
- pacotes ZIP e versões antigas de implantação.

Consulte `README-HOSTGATOR.md` para instruções detalhadas de hospedagem.
