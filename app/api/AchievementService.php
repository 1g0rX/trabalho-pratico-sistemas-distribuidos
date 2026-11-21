<?php
declare(strict_types=1);

final class AchievementService
{
    public function __construct(private PDO $pdo)
    {
    }

    public static function categoryLabel(string $criteriaType): string
    {
        if ($criteriaType === 'approved_count') return 'Progresso nas missões';
        if ($criteriaType === 'extra_count') return 'Missões extras';
        if (in_array($criteriaType, ['module_count', 'all_modules_complete', 'module_complete'], true)) return 'Cursos e formações';
        if ($criteriaType === 'enrollment_days') return 'Conquistas de trajetória';
        if (str_starts_with($criteriaType, 'module_progress:')) return 'Progresso no curso';
        if (in_array($criteriaType, ['module_extras_complete', 'module_all_complete'], true)) return 'Missões extras';

        $suffix = preg_replace('/^(manual_(teacher|admin)_|secret_teacher$)/', '', $criteriaType) ?: '';
        return match ($suffix) {
            'mastery' => 'Cursos e formações',
            'logic' => 'Lógica e resolução de problemas',
            'programming' => 'Programação e debugging',
            'robotics' => 'Robótica',
            'games' => 'Desenvolvimento de jogos',
            'apps' => 'Desenvolvimento de aplicativos',
            '3d' => 'Modelagem e impressão 3D',
            'creativity' => 'Criatividade e inovação',
            'persistence' => 'Persistência e autonomia',
            'teamwork' => 'Trabalho em equipe',
            'communication' => 'Comunicação e apresentações',
            'learning' => 'Aprendizado',
            'projects' => 'Projetos especiais',
            'trajectory' => 'Conquistas de trajetória',
            'consistency' => 'Sequências e consistência',
            'home' => 'Missões fora da aula',
            'legendary' => 'Conquistas lendárias',
            default => $criteriaType === 'secret_teacher' ? 'Conquistas secretas' : 'Outras conquistas',
        };
    }

    public static function isAutomatic(string $criteriaType): bool
    {
        return !str_starts_with($criteriaType, 'manual_') && $criteriaType !== 'secret_teacher';
    }

    public static function canGrant(array $actor, string $criteriaType): bool
    {
        if (in_array($actor['role'], ['supervisor', 'admin'], true)) return true;
        return $actor['role'] === 'teacher'
            && (str_starts_with($criteriaType, 'manual_teacher_') || $criteriaType === 'secret_teacher');
    }

    public function catalog(): array
    {
        $catalog = require __DIR__ . '/achievement_catalog.php';
        $modules = $this->pdo->query("SELECT id, name FROM modules WHERE status = 'active' ORDER BY level, id")->fetchAll();
        foreach ($modules as $module) {
            $moduleId = (int) $module['id'];
            $moduleName = (string) $module['name'];
            $catalog[] = $this->dynamicItem('Missão Cumprida', $moduleName, 'Concluiu todas as missões obrigatórias do curso.', '🏅', 'module_complete', $moduleId);
            foreach ([
                10 => ['A Jornada Começou', 'Chegou a 10% das missões obrigatórias.', '🌱'],
                25 => ['No Caminho', 'Chegou a 25% das missões obrigatórias.', '🛤️'],
                50 => ['Meio do Caminho', 'Chegou a 50% das missões obrigatórias.', '🌓'],
                75 => ['Reta Final', 'Chegou a 75% das missões obrigatórias.', '🚀'],
                90 => ['Quase Lá', 'Chegou a 90% das missões obrigatórias.', '🏁'],
                100 => ['Missão Cumprida 100%', 'Chegou a 100% das missões obrigatórias.', '💯'],
            ] as $percent => [$name, $description, $icon]) {
                $catalog[] = $this->dynamicItem($name, $moduleName, $description, $icon, 'module_progress:' . $moduleId, $percent);
            }
            $catalog[] = $this->dynamicItem('Além dos 100%', $moduleName, 'Concluiu todas as missões extras do curso.', '⭐', 'module_extras_complete', $moduleId);
            $catalog[] = $this->dynamicItem('Não Era Obrigatório!', $moduleName, 'Concluiu todas as missões extras do curso.', '💎', 'module_extras_complete', $moduleId);
            $catalog[] = $this->dynamicItem('Perfeccionista', $moduleName, 'Concluiu todas as missões obrigatórias e extras do curso.', '🏆', 'module_all_complete', $moduleId);
            $catalog[] = $this->dynamicItem('100% Absoluto', $moduleName, 'Concluiu todas as missões obrigatórias e extras da formação.', '💎', 'module_all_complete', $moduleId);
        }
        return $catalog;
    }

    private function dynamicItem(string $name, string $moduleName, string $description, string $icon, string $criteriaType, int $criteriaValue): array
    {
        $available = max(12, 97 - mb_strlen($name, 'UTF-8'));
        return [
            $name . ' — ' . mb_substr($moduleName, 0, $available, 'UTF-8'),
            $description,
            $icon,
            $criteriaType,
            $criteriaValue,
            0,
            'active',
        ];
    }

    public function syncCatalog(): array
    {
        $statement = $this->pdo->prepare("\n            INSERT IGNORE INTO medals\n                (name, description, icon, criteria_type, criteria_value, joys_reward, status)\n            VALUES (?, ?, ?, ?, ?, ?, ?)\n        ");
        $inserted = 0;
        $catalog = $this->catalog();
        foreach ($catalog as $item) {
            $statement->execute($item);
            $inserted += $statement->rowCount();
        }
        return ['inserted' => $inserted, 'available' => count($catalog)];
    }

    public function evaluateStudent(int $studentId): array
    {
        if ($studentId <= 0) return [];

        $counts = $this->pdo->prepare("\n            SELECT\n                COUNT(DISTINCT CASE WHEN sm.status = 'approved' THEN ms.id END) AS approved_count,\n                COUNT(DISTINCT CASE WHEN sm.status = 'approved' AND ms.type = 'extra' THEN ms.id END) AS extra_count\n            FROM missions ms\n            LEFT JOIN student_missions sm\n              ON sm.mission_id = ms.id\n             AND sm.student_id = ?\n            WHERE ms.status = 'active'\n        ");
        $counts->execute([$studentId]);
        $missionCounts = $counts->fetch() ?: ['approved_count' => 0, 'extra_count' => 0];

        $submissionCount = $this->scalar('SELECT COUNT(*) FROM submissions WHERE student_id = ?', [$studentId]);
        $stlCount = $this->scalar("\n            SELECT COUNT(*)\n            FROM submission_files sf\n            JOIN submissions sub ON sub.id = sf.submission_id\n            WHERE sub.student_id = ? AND sf.file_type = 'stl'\n        ", [$studentId]);
        $enrollmentDays = $this->scalar("\n            SELECT GREATEST(0, DATEDIFF(CURDATE(), COALESCE(s.enrolled_at, DATE(u.created_at))))\n            FROM students s\n            JOIN users u ON u.id = s.user_id\n            WHERE s.user_id = ?\n        ", [$studentId]);

        $progressStatement = $this->pdo->prepare("\n            SELECT m.id,\n                   COUNT(DISTINCT CASE WHEN ms.status = 'active' AND ms.type = 'required' THEN ms.id END) AS required_total,\n                   COUNT(DISTINCT CASE WHEN ms.status = 'active' AND ms.type = 'required' AND sm.status = 'approved' THEN ms.id END) AS required_done,\n                   COUNT(DISTINCT CASE WHEN ms.status = 'active' AND ms.type = 'extra' THEN ms.id END) AS extra_total,\n                   COUNT(DISTINCT CASE WHEN ms.status = 'active' AND ms.type = 'extra' AND sm.status = 'approved' THEN ms.id END) AS extra_done,\n                   MAX(CASE WHEN completion.student_id IS NULL THEN 0 ELSE 1 END) AS recorded_complete\n            FROM modules m\n            LEFT JOIN missions ms ON ms.module_id = m.id\n            LEFT JOIN student_missions sm\n              ON sm.mission_id = ms.id\n             AND sm.student_id = ?\n            LEFT JOIN student_module_completions completion\n              ON completion.module_id = m.id\n             AND completion.student_id = ?\n            WHERE m.status = 'active'\n            GROUP BY m.id\n            ORDER BY m.level, m.id\n        ");
        $progressStatement->execute([$studentId, $studentId]);
        $moduleProgress = [];
        $completedModules = [];
        foreach ($progressStatement->fetchAll() as $row) {
            $moduleId = (int) $row['id'];
            $requiredTotal = (int) $row['required_total'];
            $requiredDone = (int) $row['required_done'];
            $extraTotal = (int) $row['extra_total'];
            $extraDone = (int) $row['extra_done'];
            $requiredComplete = (bool) $row['recorded_complete'] || ($requiredTotal > 0 && $requiredDone === $requiredTotal);
            if ($requiredComplete) $completedModules[$moduleId] = true;
            $moduleProgress[$moduleId] = [
                'percent' => $requiredTotal > 0 ? (int) floor(($requiredDone / $requiredTotal) * 100) : 0,
                'requiredComplete' => $requiredComplete,
                'extraComplete' => $extraTotal > 0 && $extraDone === $extraTotal,
            ];
        }

        $activeModuleCount = count($moduleProgress);
        $facts = [
            'approved_count' => (int) $missionCounts['approved_count'],
            'extra_count' => (int) $missionCounts['extra_count'],
            'module_count' => count($completedModules),
            'all_modules_complete' => $activeModuleCount > 0 && count($completedModules) >= $activeModuleCount,
            'first_submission' => $submissionCount > 0,
            'stl_upload' => $stlCount > 0,
            'enrollment_days' => $enrollmentDays,
        ];

        $earnedStatement = $this->pdo->prepare('SELECT medal_id FROM student_medals WHERE student_id = ?');
        $earnedStatement->execute([$studentId]);
        $earned = array_fill_keys(array_map('intval', $earnedStatement->fetchAll(PDO::FETCH_COLUMN)), true);
        $medals = $this->pdo->query("\n            SELECT id, name, description, icon, criteria_type, criteria_value\n            FROM medals\n            WHERE status = 'active'\n            ORDER BY id\n        ")->fetchAll();
        $insert = $this->pdo->prepare("\n            INSERT IGNORE INTO student_medals (student_id, medal_id, notes, earned_at)\n            VALUES (?, ?, 'Conquista concedida automaticamente pelo sistema.', NOW())\n        ");
        $newAwards = [];
        foreach ($medals as $medal) {
            $medalId = (int) $medal['id'];
            if (isset($earned[$medalId])) continue;
            $criteriaType = (string) $medal['criteria_type'];
            $criteriaValue = (int) ($medal['criteria_value'] ?? 0);
            if (!$this->criteriaReached($criteriaType, $criteriaValue, $facts, $moduleProgress)) continue;
            $insert->execute([$studentId, $medalId]);
            if ($insert->rowCount() === 0) continue;
            awardMedalJoys($this->pdo, $studentId, $medalId);
            $newAwards[] = ['id' => $medalId, 'nome' => $medal['name'], 'descricao' => $medal['description'], 'icone' => $medal['icon']];
        }
        return $newAwards;
    }

    private function criteriaReached(string $type, int $value, array $facts, array $moduleProgress): bool
    {
        if (isset($facts[$type]) && is_bool($facts[$type])) return $facts[$type];
        if (isset($facts[$type]) && is_int($facts[$type])) return $facts[$type] >= max(1, $value);
        if ($type === 'module_complete') return !empty($moduleProgress[$value]['requiredComplete']);
        if ($type === 'module_extras_complete') return !empty($moduleProgress[$value]['extraComplete']);
        if ($type === 'module_all_complete') return !empty($moduleProgress[$value]['requiredComplete']) && !empty($moduleProgress[$value]['extraComplete']);
        if (str_starts_with($type, 'module_progress:')) {
            $moduleId = (int) substr($type, strlen('module_progress:'));
            return ($moduleProgress[$moduleId]['percent'] ?? 0) >= max(1, $value);
        }
        return false;
    }

    public function grant(int $studentId, int $medalId, int $grantedBy, string $notes): bool
    {
        $statement = $this->pdo->prepare("\n            INSERT IGNORE INTO student_medals (student_id, medal_id, granted_by, notes, earned_at)\n            VALUES (?, ?, ?, ?, NOW())\n        ");
        $statement->execute([$studentId, $medalId, $grantedBy, mb_substr($notes, 0, 500, 'UTF-8')]);
        if ($statement->rowCount() === 0) return false;
        awardMedalJoys($this->pdo, $studentId, $medalId);
        return true;
    }

    public function revoke(int $studentId, int $medalId): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM student_medals WHERE student_id = ? AND medal_id = ?');
        $statement->execute([$studentId, $medalId]);
        return $statement->rowCount() > 0;
    }

    private function scalar(string $sql, array $params): int
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return (int) $statement->fetchColumn();
    }
}
