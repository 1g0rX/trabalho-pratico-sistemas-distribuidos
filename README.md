# Trabalho Prático — Prática 2: Observabilidade e Monitoramento de Recursos do SO

Repositório do grupo para a disciplina de **Sistemas Operacionais Modernos** (CEFET-MG — Prof. Michel Pires da Silva).  
**Entrega:** 21/11/2026 | **Apresentação (Live Demo):** 23/11/2026

O projeto consiste em monitorar métricas do sistema operacional hospedeiro e de containers (**CPU, Memória RAM, I/O de disco e Tráfego de rede**) utilizando **Prometheus, Grafana, cAdvisor e Node Exporter** via **Docker Compose**, enquanto uma cópia local do sistema de gestão educacional é submetida a testes de carga (usuários simultâneos, compras concorrentes na loja e envio simultâneo de atividades com entradas de tamanhos variados).

---

## Padrão do Projeto

Para que todos trabalhem em paralelo sem dependências entre si, o projeto segue estas definições fixas:

- **Rede Docker:** `monitoring-net`
- **Serviços e Portas:**
  - `app` (sistema CreateJoy completo em PHP/Apache): `8000`
  - `db` (MariaDB compatível com o MySQL da HostGator): `5432` no computador, `3306` na rede Docker
  - `cadvisor` (métricas por container): `8080`
  - `node-exporter` (métricas do SO hospedeiro): `9100`
  - `prometheus` (coleta e armazenamento de métricas): `9090`
  - `grafana` (dashboards): `3000`
  - `locust` (testes de carga em Python): `8089`

**Fluxo no Git:** cada membro cria sua própria branch a partir da `main` e edita apenas a sua pasta/arquivo para evitar conflitos no merge.

---

## Divisão de Funções

### Membro 1 (Lívia) — Aplicação Local e Banco (`app/` | branch `feat/app`)
- **O que vai fazer:** containerizar a cópia local do sistema educacional e preparar o banco de dados com dados de teste.
- **Entregas:**
  - Criar o `Dockerfile` em `app/` expondo a aplicação na porta `8000`.
  - Criar o script de *seed* para popular o banco com dados fictícios (alunos, itens da loja e atividades).
  - Preencher `app/ROTAS.md` com as rotas reais de login, listagem, compra na loja e envio de atividade.
- **Como testar:** subir a aplicação e o banco localmente e validar que as rotas respondem conforme documentado em `app/ROTAS.md`.

### Membro 2 (Gustavo) — Infraestrutura e Monitoramento (`docker-compose.yml`, `prometheus/`, `grafana/provisioning/` | branch `feat/monitoramento`)
- **O que vai fazer:** manter a orquestração dos containers, configurar a coleta no Prometheus e montar os painéis no Grafana.
- **Entregas:**
  - Validar `docker-compose.yml` (rede `monitoring-net`, volumes `db_data`, `prometheus_data`, `grafana_data` e dependências). Quando `app/Dockerfile` estiver pronto, substituir `httpbin` por `build: ./app`, ajustar a porta para `8000:8000` e atualizar o `--host` do Locust para `http://app:8000`.
  - Validar `prometheus/prometheus.yml` (coleta configurada a cada `5s`).
  - Montar no Grafana o Dashboard com gráficos de **CPU** (Host e por container), **Memória RAM** (Host e por container), **I/O de Disco** e **Tráfego de Rede**, exportando o `.json` para `grafana/provisioning/dashboards/`.
- **Como testar:** executar `docker compose up -d`, verificar em `http://localhost:9090/targets` se `prometheus`, `cadvisor` e `node-exporter` estão **`UP`**, e confirmar em `http://localhost:3000` (`admin` / `admin`) se os gráficos carregam automaticamente.

### Membro 3 — Testes de Carga: Alunos e Loja (`load-tests/locust_alunos.py` | branch `feat/carga-alunos`)
- **O que vai fazer:** simular usuários simultâneos e compras concorrentes na loja usando Python/Locust dentro do Docker.
- **Entregas:**
  - Atualizar `load-tests/locust_alunos.py` com as rotas reais definidas em `app/ROTAS.md` (login, listagem e compra na loja).
  - Configurar cenários com diferentes quantidades de usuários simultâneos (ex: 10, 50, 200+).
- **Como testar:** executar `docker compose up -d`, acessar `http://localhost:8089` e iniciar o teste contra o placeholder `httpbin` (ou contra `app` quando disponível).

### Membro 4 — Testes de Carga: Atividades e Entradas Variadas (`load-tests/locust_atividades.py` | branch `feat/carga-atividades`)
- **O que vai fazer:** simular o envio simultâneo de atividades variando o tamanho das entradas para observar o impacto em memória, disco e rede.
- **Entregas:**
  - Atualizar `load-tests/locust_atividades.py` com a rota real de envio de atividade de `app/ROTAS.md`.
  - Validar os envios com entradas de **1 KB (pequena)**, **100 KB (média)** e **5 MB (grande)**.
  - Na etapa de integração, executar os testes completos e coletar os prints do Grafana e logs (sistema ocioso vs. sobrecarga) em `relatorio/imagens/`.
- **Como testar:** acessar `http://localhost:8089` com o serviço `locust` apontando para `locust_atividades.py` e validar o disparo dos três tamanhos de payload.

### Membro 5 — Diagrama e Relatório em LaTeX (`relatorio/` | branch `feat/relatorio`)
- **O que vai fazer:** elaborar o diagrama arquitetural e consolidar o relatório técnico no modelo IEEE (`relatorio/main.tex`).
- **Entregas:**
  - Criar o diagrama mostrando todos os containers, a rede `monitoring-net` e os volumes, salvando em `relatorio/imagens/`.
  - Preencher os nomes dos autores e as 6 seções obrigatórias de `relatorio/main.tex` (Introdução, Mapeamento da Solução e Arquitetura, Tecnologias Utilizadas, Execução e Validação Experimental, Conclusão e Repositório).
  - Inserir os prints/logs coletados pelo Membro 4 e gerar o PDF final.
- **Como testar:** compilar `relatorio/main.tex` no Overleaf ou localmente sem erros de build.

---

## Como executar o ambiente

1. **(Opcional) Criar arquivo `.env` local:**
   ```bash
   cp .env.example .env
   ```

2. **Subir todos os containers:**
   ```bash
   docker compose up -d
   ```

3. **Acessar as interfaces:**
   - **CreateJoy completo:** `http://localhost:8000`
   - **Prometheus (Targets):** `http://localhost:9090/targets`
   - **Grafana (Dashboards):** `http://localhost:3000` (usuário `admin` / senha `admin`)
   - **Locust (Testes de carga):** `http://localhost:8089`

4. **Entrar com dados fictícios:**
   - Aluno: `aluno.demo@createjoy.local`
   - Professor: `professor.demo@createjoy.local`
   - Supervisão: `supervisao.demo@createjoy.local`
   - Senha comum: `Admin@123`

   As demais contas de demonstração estão documentadas em `app/ROTAS.md`.

5. **Alternar o Locust para o cenário de atividades (`locust_atividades.py`):**
   No `docker-compose.yml`, altere a linha `command:` do serviço `locust` para:
   ```yaml
   command: -f /mnt/locust/locust_atividades.py --host=http://app:8000
   ```
   Em seguida, recrie apenas o container do Locust:
   ```bash
   docker compose up -d --force-recreate locust
   ```

6. **Encerrar os containers:**
   ```bash
   docker compose down
   ```

O banco local contém somente dados fictícios. Nenhuma credencial, foto, upload
ou cadastro da instalação hospedada é incluído no repositório.

---

## Nota para a Apresentação (23/11)
Durante a arguição técnica, qualquer integrante pode ser solicitado a operar o terminal ou alterar uma configuração simples ao vivo. Todos os membros devem saber subir/derrubar os containers (`docker compose up -d` / `down`), consultar logs (`docker compose logs -f`) e iniciar um teste no Locust.
