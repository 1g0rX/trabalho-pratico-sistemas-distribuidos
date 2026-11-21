# Monitoramento do CreateJoy

Este guia explica como iniciar o ambiente local, executar os testes de carga e
interpretar as métricas coletadas pelo Prometheus e exibidas no Grafana.

O ambiente usa somente contas e dados fictícios. Ele não se conecta ao banco da
HostGator e não contém cadastros da instalação de produção.

## 1. Pré-requisitos

No Windows, instale e configure:

- Docker Desktop com o mecanismo WSL 2;
- WSL 2 e virtualização habilitada na BIOS/UEFI;
- Docker Compose v2, incluído no Docker Desktop;
- Git para baixar e alternar as branches do projeto;
- pelo menos 4 GB de memória livres e aproximadamente 3 GB de espaço em disco;
- portas `3000`, `5432`, `8000`, `8080`, `8089`, `9090` e `9100` disponíveis.

Confirme a instalação no PowerShell:

```powershell
wsl --status
docker version
docker compose version
```

O Docker Desktop deve estar aberto e indicar que o mecanismo está em execução.

## 2. Iniciar o ambiente

Na raiz do repositório, use a branch de integração do monitoramento:

```powershell
git switch feat/monitoramento
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

O arquivo `.env` é local e não deve ser enviado ao Git. Se ele não for criado,
os valores de demonstração definidos no `docker-compose.yml` serão utilizados.

Em `docker compose ps`, `app` e `db` devem aparecer como `healthy`, e os demais
serviços devem aparecer como `Up`.

## 3. Serviços e endereços

| Serviço | Função | Endereço |
| --- | --- | --- |
| CreateJoy | Aplicação PHP/Apache monitorada | <http://localhost:8000> |
| Grafana | Dashboard e visualização das métricas | <http://localhost:3000> |
| Prometheus | Coleta, armazenamento e consulta | <http://localhost:9090> |
| cAdvisor | Métricas dos containers | <http://localhost:8080> |
| Node Exporter | Métricas do ambiente Linux do Docker | <http://localhost:9100/metrics> |
| Locust | Geração de usuários e solicitações simultâneas | <http://localhost:8089> |
| MariaDB | Banco local de demonstração | `localhost:5432` |

Credenciais do Grafana:

- usuário: `admin`;
- senha: `admin`.

O Prometheus, o cAdvisor, o Node Exporter e o Locust não possuem login neste
ambiente local.

## 4. Como a coleta funciona

O fluxo do monitoramento é:

1. o Node Exporter expõe CPU, memória, disco e rede do ambiente Linux executado
   pelo Docker Desktop;
2. o cAdvisor expõe consumo de CPU, memória, disco e rede de cada container;
3. o CreateJoy expõe métricas da aplicação em `/metrics/index.php`;
4. o Prometheus consulta essas fontes a cada 5 segundos e guarda o histórico por
   7 dias no volume `prometheus_data`;
5. o Grafana consulta o Prometheus e monta automaticamente o dashboard
   **Observabilidade CreateJoy**;
6. o Locust gera carga para que seja possível comparar o sistema ocioso com o
   sistema sob uso simultâneo.

No Windows, as métricas chamadas de **host** representam principalmente a máquina
Linux interna do Docker Desktop. As métricas nativas completas do Windows não são
coletadas pelo Node Exporter.

## 5. Verificar o Prometheus

Acesse <http://localhost:9090/targets>. Os alvos abaixo devem estar como `UP`:

- `prometheus`;
- `cadvisor`;
- `node-exporter`;
- `createjoy-app`.

Em <http://localhost:9090/graph> é possível consultar uma métrica diretamente.
Exemplos:

```promql
createjoy_up
createjoy_pending_submissions
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)
```

`createjoy_up` deve retornar `1`. O valor `0`, a ausência de resultado ou um alvo
`DOWN` indica que a fonte não está sendo coletada corretamente.

## 6. Dashboard do Grafana

Depois de entrar no Grafana, abra **Dashboards > Observabilidade CreateJoy**.
O dashboard é carregado automaticamente do arquivo
`grafana/provisioning/dashboards/observabilidade-so.json`.

### CPU do host

Mostra a porcentagem de CPU utilizada pelo ambiente Linux do Docker. Picos durante
um teste são esperados. Uso próximo de 100% por muito tempo indica saturação.

### CPU por container

Compara o consumo dos containers `app`, `db`, `prometheus`, `grafana`, `locust` e
coletores. Em máquinas com vários núcleos, a soma de um container pode superar
100%, pois 100% corresponde aproximadamente a um núcleo totalmente utilizado.

### Memória RAM do host

Mostra o percentual de memória em uso. Crescimento durante a carga é normal;
permanecer muito alto depois do teste pode indicar falta de memória ou retenção.

### Memória RAM por container

Mostra o conjunto de memória efetivamente utilizado por cada container. Serve para
identificar se aplicação, banco, Locust ou ferramentas de monitoramento concentram
o consumo.

### I/O de disco do host e por container

Exibe bytes lidos e gravados por segundo. Picos no `db` são comuns ao cadastrar
solicitações. Valores altos e contínuos acompanhados de aumento de latência podem
indicar gargalo de armazenamento.

### Tráfego de rede do host e por container

Exibe bytes recebidos e enviados por segundo. O tráfego deve crescer com o número
de usuários do Locust e com o tamanho das respostas da aplicação.

### Aplicação disponível

Usa a métrica `createjoy_up`. O valor `1` significa que o endpoint de métricas
conseguiu acessar o sistema; outro resultado exige verificar aplicação e banco.

### Entregas pendentes

Usa `createjoy_pending_submissions` e mostra quantas atividades fictícias aguardam
correção no banco local. É uma métrica funcional da aplicação, não de hardware.

Para interpretar corretamente, compare o mesmo intervalo de tempo antes, durante
e depois do teste. No canto superior direito do Grafana, selecione, por exemplo,
**Last 15 minutes** e ative a atualização automática de 5 segundos.

## 7. Executar o teste de carga

Se o Locust já estava aberto antes de uma alteração no arquivo de teste, reinicie-o
para carregar as rotas atuais:

```powershell
docker compose restart locust
```

Acesse <http://localhost:8089> e informe, por exemplo:

- **Number of users:** `10`;
- **Ramp up:** `2` usuários por segundo;
- **Host:** `http://app:8000`, caso o campo seja exibido.

O cenário atual autentica um aluno fictício, carrega o painel, abre a CreateStore e
cria solicitações fictícias de produtos.

Na tabela de resultados:

- **Requests**: total de requisições executadas;
- **Fails**: quantidade de falhas;
- **Median**: tempo central de resposta;
- **95%ile**: 95% das respostas terminaram em até esse tempo;
- **99%ile**: 99% terminaram em até esse tempo;
- **Average**: média de duração;
- **Min/Max**: menor e maior tempo observado.

Um teste válido deve apresentar `Fails` igual a zero ou permitir explicar cada
falha. Se `Requests` e `Fails` tiverem o mesmo valor, houve 100% de erro e o teste
não pode ser considerado concluído. Nessa situação, verifique se a tabela ainda
mostra rotas antigas como `/api/login` ou `/api/alunos/dashboard`; reinicie o
Locust e confirme as rotas documentadas em `app/ROTAS.md`.

## 8. Comandos úteis

```powershell
# Acompanhar os logs de todos os serviços
docker compose logs -f

# Ver somente os logs da aplicação
docker compose logs -f app

# Reiniciar Prometheus e Grafana
docker compose restart prometheus grafana

# Parar os containers preservando os dados locais
docker compose down

# Reconstruir depois de alterar o código
docker compose up -d --build
```

Não use `docker compose down -v` para uma parada normal. A opção `-v` apaga os
volumes e remove o banco fictício e o histórico local de métricas.

## 9. Solução de problemas

### Docker informa que WSL não está instalado

Abra o PowerShell como administrador, execute `wsl --install`, reinicie o Windows
e confirme que a virtualização está habilitada.

### Um alvo aparece como DOWN no Prometheus

Execute `docker compose ps` e `docker compose logs NOME_DO_SERVICO`. Corrija o
serviço que não estiver `Up` e aguarde pelo menos dois ciclos de coleta.

### O Grafana abre sem dados

Confirme os Targets no Prometheus, selecione **Last 15 minutes**, aguarde de 15 a
30 segundos e atualize o dashboard. O datasource é provisionado automaticamente.

### Uma porta já está em uso

Feche o programa que usa a porta ou altere somente a porta do lado esquerdo no
`docker-compose.yml`, preservando a porta interna do container.

## 10. Checklist de validação

O ambiente está pronto quando:

- `docker compose ps` mostra a aplicação e o banco como `healthy`;
- os quatro Targets do Prometheus aparecem como `UP`;
- o dashboard **Observabilidade CreateJoy** abre com dados;
- o login fictício do CreateJoy funciona;
- o teste atual do Locust termina sem falhas inesperadas;
- CPU, memória, disco e rede variam durante o teste de carga.
