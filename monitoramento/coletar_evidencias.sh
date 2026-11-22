#!/usr/bin/env bash
set -euo pipefail

# Script auxiliar para executar os cenários de carga em ambiente com Docker
# e salvar logs/CSVs padronizados em relatorio/evidencias/ para o relatório IEEE.

OUT_DIR="relatorio/evidencias"
mkdir -p "$OUT_DIR"

echo "[1/5] Validando containers em execução..."
docker compose ps > "$OUT_DIR/docker_ps.txt"
cat "$OUT_DIR/docker_ps.txt"

echo "[2/5] Coletando status dos alvos no Prometheus..."
curl -fsS "http://localhost:9090/api/v1/targets" > "$OUT_DIR/prometheus_targets.json"

echo "[3/5] Coletando métricas da aplicação (/metrics/index.php) em estado ocioso..."
curl -fsS "http://localhost:8000/metrics/index.php" > "$OUT_DIR/metrics_ocioso.txt"

echo "[4/5] Executando Cenário 1: locust_alunos.py (10, 50 e 100 usuários por 60s cada)..."
for USERS in 10 50 100; do
  SPAWN=$(( USERS / 5 ))
  [ "$SPAWN" -lt 2 ] && SPAWN=2
  echo "  -> Rodando locust_alunos.py com $USERS usuários (ramp-up $SPAWN/s)..."
  docker compose run --rm --no-deps locust \
    -f /mnt/locust/locust_alunos.py \
    --host=http://app:8000 \
    --headless -u "$USERS" -r "$SPAWN" -t 60s \
    --csv="/tmp/alunos_${USERS}u" \
    --csv-full-history > "$OUT_DIR/locust_alunos_${USERS}u.log" 2>&1 || true
done

echo "[5/5] Executando Cenário 2: locust_atividades.py (pequeno 1KB, medio 100KB, grande 5MB)..."
for MODO in pequeno medio grande; do
  echo "  -> Rodando locust_atividades.py modo=$MODO (20 usuários, 60s)..."
  docker compose run --rm --no-deps -e "TAMANHO_ENTRADA=$MODO" locust \
    -f /mnt/locust/locust_atividades.py \
    --host=http://app:8000 \
    --headless -u 20 -r 4 -t 60s \
    > "$OUT_DIR/locust_atividades_${MODO}.log" 2>&1 || true
done

curl -fsS "http://localhost:8000/metrics/index.php" > "$OUT_DIR/metrics_pos_carga.txt"

echo "Concluído! Logs salvos em $OUT_DIR/."
echo "Lembre-se de salvar também os prints do Grafana (ocioso vs. picos) em relatorio/imagens/."
