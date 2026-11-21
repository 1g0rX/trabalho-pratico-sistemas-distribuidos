# Contrato de Rotas da Aplicação

Rotas da cópia local isolada da CreateJoy. O banco contém somente dados fictícios e pode ser recriado removendo o volume `db_data`.

## Informações Gerais
- **Porta interna do container `app`:** `8000` (se diferente, avisar o Membro 2 e o grupo)
- **Autenticação:** token Bearer retornado pela rota de login, válido por 12 horas.
- **Usuário de teste (seed):**
  - E-mail/Login: `aluno.teste@createjoy.test`
  - Senha: `Create123`

---

## 1. Login / Autenticação
- **Método e Rota:** `POST /api/login`
- **Payload (JSON):**
  ```json
  {
    "email": "aluno.teste@createjoy.test",
    "password": "Create123"
  }
  ```
- **Resposta esperada:** `200 OK`, com `token` e os dados do usuário.
- **Cabeçalho nas próximas rotas:** `Authorization: Bearer <token>`.

---

## 2. Requisições de Alunos (Leitura / Navegação)
- **Método e Rota:** `GET /api/alunos/dashboard`
- **Outras rotas de listagem:** `GET /api/loja/produtos`, `GET /api/atividades`

---

## 3. Compras Simultâneas na Loja
- **Método e Rota:** `POST /api/loja/comprar`
- **Payload (JSON):**
  ```json
  {
    "produto_id": 1,
    "quantidade": 1
  }
  ```

---

## 4. Envio Simultâneo de Atividades
- **Método e Rota:** `POST /api/atividades/enviar`
- **Tipo de conteúdo:** `application/json` com limite de 6 MB.
- **Payload (JSON):**
  ```json
  {
    "atividade_id": 1,
    "conteudo": "texto ou base64 de tamanho variável"
  }
  ```

---

## 5. Saúde e métricas
- `GET /health`: verifica a aplicação e a conexão com o PostgreSQL.
- `GET /metrics`: expõe métricas no formato Prometheus.
