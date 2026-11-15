# Contrato de Rotas da Aplicação (Membro 1)

Preencha este arquivo com as rotas reais da cópia local do sistema de gestão educacional para que os Membros 3 e 4 ajustem os scripts do Locust sem depender de reuniões.

## Informações Gerais
- **Porta interna do container `app`:** `8000` (se diferente, avisar o Membro 2 e o grupo)
- **Autenticação:** (ex: Bearer Token JWT / Cookie de sessão / Sem auth em rota de teste)
- **Usuário de teste (seed):**
  - E-mail/Login: `aluno.teste@cefetmg.br`
  - Senha: `123456`

---

## 1. Login / Autenticação
- **Método e Rota:** `POST /api/login` *(substituir pela rota real)*
- **Payload (JSON):**
  ```json
  {
    "email": "aluno.teste@cefetmg.br",
    "password": "123456"
  }
  ```
- **Resposta esperada:** `200 OK` (ex: retorna `token` ou seta cookie)

---

## 2. Requisições de Alunos (Leitura / Navegação)
- **Método e Rota:** `GET /api/alunos/dashboard` *(substituir pela rota real)*
- **Outras rotas de listagem:** `GET /api/loja/produtos`, `GET /api/atividades`

---

## 3. Compras Simultâneas na Loja
- **Método e Rota:** `POST /api/loja/comprar` *(substituir pela rota real)*
- **Payload (JSON):**
  ```json
  {
    "produto_id": 1,
    "quantidade": 1
  }
  ```

---

## 4. Envio Simultâneo de Atividades
- **Método e Rota:** `POST /api/atividades/enviar` *(substituir pela rota real)*
- **Tipo de conteúdo:** `application/json` ou `multipart/form-data`
- **Payload (JSON):**
  ```json
  {
    "atividade_id": 1,
    "conteudo": "texto ou base64 de tamanho variável"
  }
  ```
