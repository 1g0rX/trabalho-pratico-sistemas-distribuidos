# Rotas reais do CreateJoy

A aplicação completa é servida em `http://localhost:8000`. A API PHP usa o
endpoint `/api/index.php` e identifica cada operação pelo parâmetro `route`.
As rotas autenticadas usam a sessão `CREATEJOYSESSID` e, em alterações, o
token retornado no login no cabeçalho `X-CSRF-Token`.

## Contas fictícias

Todas as contas usam a senha `Admin@123`.

| Perfil | E-mail |
| --- | --- |
| Aluno | `aluno.demo@createjoy.local` |
| Professor | `professor.demo@createjoy.local` |
| Supervisão | `supervisao.demo@createjoy.local` |
| Financeiro | `financeiro.demo@createjoy.local` |
| Gestão administrativa | `administrativo.demo@createjoy.local` |
| Admin | `admin@createjoy.com` |

## Saúde

- `GET /api/index.php?route=health`

## Login

- `POST /api/index.php?route=auth/login`
- JSON: `{"email":"aluno.demo@createjoy.local","password":"Admin@123","role":"student"}`
- A resposta contém `csrfToken`, `user` e o conjunto de dados do perfil.

## Listagem de dados, missões e loja

- `GET /api/index.php?route=bootstrap`
- Requer a sessão criada no login.
- A resposta contém `students`, `missions`, `activities`, `storeProducts`,
  `storeRequests` e os demais dados permitidos para o perfil.

## Solicitação de compra

- `POST /api/index.php?route=store/request/create`
- Cabeçalho: `X-CSRF-Token: <token-do-login>`
- JSON: `{"product_id":1,"details":"Solicitação do teste de carga"}`

## Envio de atividade/missão

- `POST /api/index.php?route=submissions/create`
- Cabeçalho: `X-CSRF-Token: <token-do-login>`
- `multipart/form-data` com `mission_id`, `notes`, `learned` e, opcionalmente,
  até três campos `files[]`.
- O limite é 5 MB por arquivo e 8 MB no total da tentativa.

## Encerrar sessão

- `POST /api/index.php?route=auth/logout`
- Cabeçalho: `X-CSRF-Token: <token-do-login>`
