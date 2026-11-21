<?php
declare(strict_types=1);

final class DataService
{
    public function __construct(private PDO $pdo)
    {
    }

    public function bootstrap(array $user): array
    {
        $isCoreManagement = in_array($user['role'], ['supervisor', 'admin'], true);
        $isAdministrative = $user['role'] === 'administrative';
        $isFinance = $user['role'] === 'finance';
        $isManagement = $isCoreManagement || $isAdministrative;
        $canViewReenrollment = $isManagement || $isFinance;
        $students = $isFinance ? [] : $this->students($user);
        $teachers = $isFinance ? [] : $this->teachers($user);
        $employees = $isManagement ? $this->employees() : [];
        $modules = $isFinance ? [] : $this->modules();
        $classes = $isFinance ? [] : $this->classes($user);
        $missions = $isFinance ? [] : $this->missions($user);
        $submissions = ($isFinance || $isAdministrative) ? [] : $this->submissions($user);
        $medals = $isFinance ? [] : $this->medals($user);
        $studentMedalAwards = [];
        if (!$isFinance && !$isAdministrative) {
            try {
                $studentMedalAwards = $this->studentMedalAwards($user);
            } catch (PDOException $exception) {
                error_log('[CreateJoy][student-medal-awards] ' . $exception->getMessage());
            }
        }
        $files = $user['role'] === 'student' ? $this->studentFiles((int) $user['id']) : [];
        $teacherMissionProgress = [];
        $teacherJoyTransactions = [];
        if ($user['role'] === 'teacher' || $isCoreManagement) {
            try {
                $teacherMissionProgress = $this->teacherMissionProgress($user);
            } catch (PDOException $exception) {
                error_log('[CreateJoy][teacher-mission-progress] ' . $exception->getMessage());
            }
            try {
                $teacherJoyTransactions = $this->teacherJoyTransactions($user);
            } catch (PDOException $exception) {
                error_log('[CreateJoy][teacher-joy-history] ' . $exception->getMessage());
            }
        }

        $reenrollment = null;
        if ($canViewReenrollment) {
            try {
                $this->cleanupExpiredFinancialAttachments();
                $reenrollment = $isFinance
                    ? $this->financialReenrollmentData()
                    : $this->reenrollmentData();
            } catch (PDOException $exception) {
                error_log('[CreateJoy][reenrollment] ' . $exception->getMessage());
                $reenrollment = $this->emptyReenrollmentData($students);
            }
        }

        $currentStudent = null;
        if ($user['role'] === 'student') {
            foreach ($students as $student) {
                if ((int) $student['id'] === (int) $user['id']) {
                    $currentStudent = $student;
                    break;
                }
            }
        }

        $currentTeacher = null;
        if ($user['role'] === 'teacher') {
            foreach ($teachers as $teacher) {
                if ((int) $teacher['id'] === (int) $user['id']) {
                    $currentTeacher = $teacher;
                    break;
                }
            }
        }
        $currentProfile = $this->ownProfile((int) $user['id']);

        return [
            'students' => $students,
            'teachers' => $teachers,
            'employees' => $employees,
            'modules' => $modules,
            'missions' => $missions,
            'classes' => $classes,
            'submissions' => $submissions,
            'medals' => $medals,
            'studentMedalAwards' => $studentMedalAwards,
            'files' => $files,
            'activities' => ($isFinance || $isAdministrative) ? [] : $this->activities($user),
            'semesters' => $isManagement ? $this->semesters() : [],
            'curriculumLevels' => $isManagement ? $this->curriculumLevels() : [],
            'labKits' => $isManagement ? $this->labKits() : ($user['role'] === 'student' ? $this->studentLabKits((int) $user['id']) : []),
            'kitAssignments' => $isManagement ? $this->kitAssignments() : [],
            'personalMaterials' => $isManagement ? $this->studentMaterialsForManagement() : ($user['role'] === 'student' ? $this->studentMaterials((int) $user['id']) : []),
            'pedagogicalNotes' => $isManagement ? $this->pedagogicalNotes() : [],
            'auditLogs' => $this->canViewAudit($user) ? $this->auditLogs() : [],
            'storeProducts' => ($isFinance || $isAdministrative) ? [] : $this->storeProducts($user),
            'storeRequests' => ($isFinance || $isAdministrative) ? [] : $this->storeRequests($user),
            'managementAnalytics' => $isCoreManagement ? $this->managementAnalytics() : null,
            'reenrollment' => $reenrollment,
            'investmentWallet' => $user['role'] === 'student' ? $this->investmentWallet((int) $user['id']) : ['products' => [], 'transactions' => []],
            'teacherMissionProgress' => $teacherMissionProgress,
            'teacherJoyTransactions' => $teacherJoyTransactions,
            'permissions' => $isManagement ? $this->permissionMatrix() : ['roles' => [], 'items' => []],
            'currentStudent' => $currentStudent,
            'currentTeacher' => $currentTeacher,
            'currentProfile' => $currentProfile,
        ];
    }

    private function ownProfile(int $userId): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, name, email, role, status, phone, avatar_path, must_change_password FROM users WHERE id = ? LIMIT 1');
        $statement->execute([$userId]);
        $row = $statement->fetch();
        if (!$row) {
            return null;
        }
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'role' => $row['role'],
            'initials' => initials($row['name']),
            'telefone' => $row['phone'] ?: '',
            'fotoUrl' => avatarUrl($row['avatar_path'], (int) $row['id']),
            'status' => $row['status'] === 'active' ? 'ativo' : 'inativo',
            'mustChangePassword' => (bool) $row['must_change_password'],
        ];
    }

    private function students(array $viewer): array
    {
        $where = '';
        $params = [];
        if ($viewer['role'] === 'student') {
            $where = 'WHERE u.id = ?';
            $params[] = (int) $viewer['id'];
        } elseif ($viewer['role'] === 'teacher') {
            $where = 'WHERE c.teacher_user_id = ?';
            $params[] = (int) $viewer['id'];
        }

        $sql = "
            SELECT u.id, u.name, u.email, u.status AS user_status, u.avatar_path, u.phone,
                   s.computer_number, s.status, s.lab_notes, s.joy_balance, s.gender,
                   c.id AS class_id, c.name AS class_name,
                   m.id AS module_id, m.name AS module_name, m.level AS module_level,
                   teacher.name AS teacher_name, semester.name AS semester_name,
                   COUNT(DISTINCT missions.id) AS missions_total,
                   COUNT(DISTINCT CASE
                       WHEN sm.status IN ('approved', 'concluded')
                         OR EXISTS (
                           SELECT 1 FROM submissions approved_submission
                           WHERE approved_submission.student_id = u.id
                             AND approved_submission.mission_id = missions.id
                             AND approved_submission.status IN ('approved', 'concluded')
                         )
                       THEN missions.id END) AS missions_done,
                   GROUP_CONCAT(DISTINCT completed_module.id ORDER BY completed_module.level SEPARATOR ',') AS completed_module_ids,
                   GROUP_CONCAT(DISTINCT completed_module.name ORDER BY completed_module.level SEPARATOR '|||') AS completed_module_names
            FROM students s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN classes c ON c.id = s.class_id
            LEFT JOIN users teacher ON teacher.id = c.teacher_user_id
            LEFT JOIN modules m ON m.id = s.current_module_id
            LEFT JOIN semesters semester ON semester.id = s.current_semester_id
            LEFT JOIN missions ON missions.module_id = m.id AND missions.status = 'active' AND missions.type = 'required'
            LEFT JOIN student_missions sm ON sm.student_id = u.id AND sm.mission_id = missions.id
            LEFT JOIN student_module_completions completion ON completion.student_id = u.id
            LEFT JOIN modules completed_module ON completed_module.id = completion.module_id
            {$where}
            GROUP BY u.id, u.name, u.email, u.status, u.avatar_path, u.phone,
                     s.computer_number, s.status, s.lab_notes, s.joy_balance, s.gender,
                     c.id, c.name, m.id, m.name, m.level, teacher.name, semester.name
            ORDER BY u.name
        ";

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $total = (int) $row['missions_total'];
            $done = (int) $row['missions_done'];
            return [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'email' => $row['email'],
                'initials' => initials($row['name']),
                'fotoUrl' => avatarUrl($row['avatar_path'], (int) $row['id']),
                'telefone' => $row['phone'] ?: '',
                'turma' => $row['class_name'] ?: 'Sem turma',
                'turmaId' => $row['class_id'] ? (int) $row['class_id'] : null,
                'modulo' => $row['module_name'] ?: 'Sem módulo',
                'moduloId' => $row['module_id'] ? (int) $row['module_id'] : null,
                'moduloLevel' => (int) ($row['module_level'] ?? 0),
                'computador' => $row['computer_number'] ?: '--',
                'progresso' => $total > 0 ? (int) round(($done / $total) * 100) : 0,
                'missoesConcluidas' => $done,
                'missoesTotal' => $total,
                'joys' => (int) $row['joy_balance'],
                'gender' => in_array($row['gender'], ['male', 'female'], true) ? $row['gender'] : 'not_informed',
                'modulosConcluidosIds' => $row['completed_module_ids'] ? array_map('intval', explode(',', $row['completed_module_ids'])) : [],
                'modulosConcluidos' => $row['completed_module_names'] ? explode('|||', $row['completed_module_names']) : [],
                'semestre' => $row['semester_name'] ?: 'Sem semestre',
                'accountStatus' => $row['user_status'] === 'active' ? 'active' : 'inactive',
                'status' => $row['user_status'] === 'active' ? $row['status'] : 'inativo',
                'professor' => $row['teacher_name'] ?: 'Não definido',
                'labNotes' => $row['lab_notes'] ?: '',
            ];
        }, $statement->fetchAll());
    }

    private function teachers(array $viewer): array
    {
        $where = "WHERE u.role = 'teacher'";
        $params = [];
        if ($viewer['role'] === 'teacher') {
            $where .= ' AND u.id = ?';
            $params[] = (int) $viewer['id'];
        } elseif ($viewer['role'] === 'student') {
            $where .= ' AND u.id = (SELECT c.teacher_user_id FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.user_id = ?)';
            $params[] = (int) $viewer['id'];
        }

        $statement = $this->pdo->prepare("
            SELECT u.id, u.name, u.email, u.status, u.avatar_path, u.phone,
                   GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR '|||') AS class_names,
                   COUNT(DISTINCT s.user_id) AS student_count
            FROM users u
            LEFT JOIN classes c ON c.teacher_user_id = u.id
            LEFT JOIN students s ON s.class_id = c.id
            {$where}
            GROUP BY u.id, u.name, u.email, u.status, u.avatar_path, u.phone
            ORDER BY u.name
        ");
        $statement->execute($params);

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'initials' => initials($row['name']),
            'fotoUrl' => avatarUrl($row['avatar_path'], (int) $row['id']),
            'telefone' => $row['phone'] ?: '',
            'turmas' => $row['class_names'] ? explode('|||', $row['class_names']) : [],
            'status' => $row['status'] === 'active' ? 'ativo' : 'inativo',
            'alunos' => (int) $row['student_count'],
        ], $statement->fetchAll());
    }

    private function teacherMissionProgress(array $viewer): array
    {
        $where = '';
        $params = [];
        if ($viewer['role'] === 'teacher') {
            $where = 'WHERE c.teacher_user_id = ?';
            $params[] = (int) $viewer['id'];
        }
        $statement = $this->pdo->prepare("
            SELECT c.id AS class_id,
                   s.user_id AS student_id,
                   ms.id AS mission_id,
                   CASE
                       WHEN EXISTS (
                           SELECT 1 FROM submissions approved_submission
                           WHERE approved_submission.student_id = s.user_id
                             AND approved_submission.mission_id = ms.id
                             AND approved_submission.status IN ('approved', 'concluded')
                       ) THEN 'approved'
                       WHEN EXISTS (
                           SELECT 1
                           FROM mission_prerequisites prerequisite
                           LEFT JOIN student_missions prerequisite_progress
                             ON prerequisite_progress.mission_id = prerequisite.prerequisite_mission_id
                            AND prerequisite_progress.student_id = s.user_id
                           WHERE prerequisite.mission_id = ms.id
                             AND COALESCE(prerequisite_progress.status, 'available') <> 'approved'
                             AND NOT EXISTS (
                                 SELECT 1 FROM submissions approved_prerequisite_submission
                                 WHERE approved_prerequisite_submission.student_id = s.user_id
                                   AND approved_prerequisite_submission.mission_id = prerequisite.prerequisite_mission_id
                                   AND approved_prerequisite_submission.status IN ('approved', 'concluded')
                             )
                       ) THEN 'blocked'
                       ELSE COALESCE(sm.status, 'available')
                   END AS progress_status
            FROM classes c
            JOIN students s ON s.class_id = c.id
            JOIN missions ms
              ON ms.module_id = s.current_module_id
             AND ms.status = 'active'
            LEFT JOIN student_missions sm
              ON sm.student_id = s.user_id
             AND sm.mission_id = ms.id
            {$where}
            ORDER BY c.name, s.user_id, ms.sort_order, ms.id
        ");
        $statement->execute($params);

        return array_map(static fn(array $row): array => [
            'classId' => (int) $row['class_id'],
            'studentId' => (int) $row['student_id'],
            'missionId' => (int) $row['mission_id'],
            'status' => $row['progress_status'] ?: 'available',
        ], $statement->fetchAll());
    }

    private function teacherJoyTransactions(array $viewer): array
    {
        $where = '';
        $params = [];
        if ($viewer['role'] === 'teacher') {
            $where = 'WHERE c.teacher_user_id = ?';
            $params[] = (int) $viewer['id'];
        }
        $statement = $this->pdo->prepare("
            SELECT jt.id, jt.student_id, jt.amount,
                   jt.balance_after, jt.transaction_type,
                   jt.reason, jt.created_at,
                   creator.name AS creator_name
            FROM joy_transactions jt
            JOIN students s ON s.user_id = jt.student_id
            JOIN classes c ON c.id = s.class_id
            LEFT JOIN users creator ON creator.id = jt.created_by
            {$where}
            ORDER BY jt.created_at DESC, jt.id DESC
            LIMIT 200
        ");
        $statement->execute($params);

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'studentId' => (int) $row['student_id'],
            'amount' => (int) $row['amount'],
            'balanceAfter' => (int) $row['balance_after'],
            'type' => $row['transaction_type'],
            'reason' => $row['reason'],
            'createdBy' => $row['creator_name'] ?: 'Sistema',
            'createdAt' => date('d/m/Y H:i', strtotime($row['created_at'])),
        ], $statement->fetchAll());
    }

    private function employees(): array
    {
        $statement = $this->pdo->query("
            SELECT u.id, u.name, u.email, u.role, u.status, u.avatar_path, u.phone,
                   GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR '|||') AS class_names,
                   COUNT(DISTINCT s.user_id) AS student_count
            FROM users u
            LEFT JOIN classes c ON c.teacher_user_id = u.id
            LEFT JOIN students s ON s.class_id = c.id
            WHERE u.role IN ('teacher', 'supervisor', 'admin', 'finance', 'administrative')
            GROUP BY u.id, u.name, u.email, u.role, u.status, u.avatar_path, u.phone
            ORDER BY u.name
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'initials' => initials($row['name']),
            'fotoUrl' => avatarUrl($row['avatar_path'], (int) $row['id']),
            'telefone' => $row['phone'] ?: '',
            'role' => $row['role'],
            'perfil' => match ($row['role']) {
                'admin' => 'Admin Geral',
                'supervisor' => 'Supervisão',
                'finance' => 'Financeiro',
                'administrative' => 'Gestão Administrativa',
                default => 'Professor',
            },
            'turmas' => $row['class_names'] ? explode('|||', $row['class_names']) : [],
            'status' => $row['status'] === 'active' ? 'ativo' : 'inativo',
            'alunos' => (int) $row['student_count'],
        ], $statement->fetchAll());
    }

    private function modules(): array
    {
        $statement = $this->pdo->query("
            SELECT m.id, m.name, m.level, m.description, m.workload_hours, m.status, m.color,
                   COUNT(ms.id) AS mission_count
            FROM modules m
            LEFT JOIN missions ms ON ms.module_id = m.id
            GROUP BY m.id, m.name, m.level, m.description, m.workload_hours, m.status, m.color
            ORDER BY m.level
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'level' => (int) $row['level'],
            'descricao' => $row['description'],
            'cargaHoraria' => (int) $row['workload_hours'],
            'status' => $row['status'] === 'active' ? 'ativo' : 'inativo',
            'missoes' => (int) $row['mission_count'],
            'cor' => $row['color'],
        ], $statement->fetchAll());
    }

    private function classes(array $viewer): array
    {
        $where = '';
        $params = [];
        if ($viewer['role'] === 'teacher') {
            $where = 'WHERE c.teacher_user_id = ?';
            $params[] = (int) $viewer['id'];
        } elseif ($viewer['role'] === 'student') {
            $where = 'WHERE c.id = (SELECT class_id FROM students WHERE user_id = ?)';
            $params[] = (int) $viewer['id'];
        }

        $statement = $this->pdo->prepare("
            SELECT c.id, c.name, c.schedule, c.status, c.teacher_user_id, c.semester_id,
                   teacher.name AS teacher_name, semester.name AS semester_name,
                   COUNT(DISTINCT s.user_id) AS student_count,
                   GROUP_CONCAT(DISTINCT m.name ORDER BY m.level SEPARATOR '|||') AS module_names,
                   GROUP_CONCAT(DISTINCT m.id ORDER BY m.level SEPARATOR ',') AS module_ids,
                   COUNT(DISTINCT CASE WHEN s.user_id IS NOT NULL THEN CONCAT(s.user_id, '-', ms.id) END) AS mission_total,
                   COUNT(DISTINCT CASE
                       WHEN sm.status IN ('approved', 'concluded')
                         OR EXISTS (
                           SELECT 1 FROM submissions approved_submission
                           WHERE approved_submission.student_id = s.user_id
                             AND approved_submission.mission_id = ms.id
                             AND approved_submission.status IN ('approved', 'concluded')
                         )
                       THEN CONCAT(s.user_id, '-', ms.id) END) AS mission_done
            FROM classes c
            LEFT JOIN users teacher ON teacher.id = c.teacher_user_id
            LEFT JOIN semesters semester ON semester.id = c.semester_id
            LEFT JOIN students s ON s.class_id = c.id
            LEFT JOIN class_modules cm ON cm.class_id = c.id
            LEFT JOIN modules m ON m.id = cm.module_id
            LEFT JOIN missions ms ON ms.module_id = s.current_module_id AND ms.status = 'active' AND ms.type = 'required'
            LEFT JOIN student_missions sm ON sm.student_id = s.user_id AND sm.mission_id = ms.id
            {$where}
            GROUP BY c.id, c.name, c.schedule, c.status, c.teacher_user_id, c.semester_id, teacher.name, semester.name
            ORDER BY c.name
        ");
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $students = (int) $row['student_count'];
            $possible = (int) $row['mission_total'];
            return [
                'id' => (int) $row['id'],
                'nome' => $row['name'],
                'professor' => $row['teacher_name'] ?: 'Não definido',
                'alunos' => $students,
                'modulos' => $row['module_names'] ? explode('|||', $row['module_names']) : [],
                'horarios' => $row['schedule'] ?: 'Não definido',
                'professorId' => $row['teacher_user_id'] ? (int) $row['teacher_user_id'] : null,
                'semestreId' => $row['semester_id'] ? (int) $row['semester_id'] : null,
                'semestre' => $row['semester_name'] ?: 'Sem semestre',
                'moduloIds' => $row['module_ids'] ? array_map('intval', explode(',', $row['module_ids'])) : [],
                'progresso' => $possible > 0 ? (int) round(((int) $row['mission_done'] / $possible) * 100) : 0,
                'status' => $row['status'] === 'active' ? 'ativa' : 'inativa',
            ];
        }, $statement->fetchAll());
    }

    private function missions(array $viewer): array
    {
        $params = [];
        $progressJoin = '';
        $effectiveProgress = 'sm.status AS progress_status';
        $where = '';
        if ($viewer['role'] === 'student') {
            $effectiveProgress = "CASE
                WHEN EXISTS (
                    SELECT 1 FROM submissions approved_submission
                    WHERE approved_submission.student_id = ?
                      AND approved_submission.mission_id = ms.id
                      AND approved_submission.status IN ('approved', 'concluded')
                ) THEN 'approved'
                WHEN EXISTS (
                    SELECT 1
                    FROM mission_prerequisites prerequisite
                    LEFT JOIN student_missions prerequisite_progress
                      ON prerequisite_progress.mission_id = prerequisite.prerequisite_mission_id
                     AND prerequisite_progress.student_id = ?
                    WHERE prerequisite.mission_id = ms.id
                      AND COALESCE(prerequisite_progress.status, 'available') <> 'approved'
                      AND NOT EXISTS (
                          SELECT 1 FROM submissions approved_prerequisite_submission
                          WHERE approved_prerequisite_submission.student_id = " . (int) $viewer['id'] . "
                            AND approved_prerequisite_submission.mission_id = prerequisite.prerequisite_mission_id
                            AND approved_prerequisite_submission.status IN ('approved', 'concluded')
                      )
                ) THEN 'blocked'
                ELSE COALESCE(sm.status, 'available')
            END AS progress_status";
            $params[] = (int) $viewer['id'];
            $params[] = (int) $viewer['id'];
            $progressJoin = 'LEFT JOIN student_missions sm ON sm.mission_id = ms.id AND sm.student_id = ?';
            $params[] = (int) $viewer['id'];
            $where = "WHERE ms.status = 'active' AND ms.module_id = (
                SELECT student.current_module_id
                FROM students student
                WHERE student.user_id = ?
            )
            AND (
                ms.type = 'required'
                OR (
                    EXISTS (SELECT 1 FROM mission_prerequisites extra_requirement WHERE extra_requirement.mission_id = ms.id)
                    AND NOT EXISTS (
                        SELECT 1
                        FROM mission_prerequisites extra_requirement
                        LEFT JOIN student_missions extra_progress
                          ON extra_progress.mission_id = extra_requirement.prerequisite_mission_id
                         AND extra_progress.student_id = " . (int) $viewer['id'] . "
                        WHERE extra_requirement.mission_id = ms.id
                          AND COALESCE(extra_progress.status, 'available') <> 'approved'
                          AND NOT EXISTS (
                              SELECT 1 FROM submissions approved_extra_submission
                              WHERE approved_extra_submission.student_id = " . (int) $viewer['id'] . "
                                AND approved_extra_submission.mission_id = extra_requirement.prerequisite_mission_id
                                AND approved_extra_submission.status IN ('approved', 'concluded')
                          )
                    )
                )
            )";
            $params[] = (int) $viewer['id'];
        } else {
            $progressJoin = 'LEFT JOIN student_missions sm ON 1 = 0';
        }

        $statement = $this->pdo->prepare("
            SELECT ms.*, m.name AS module_name, {$effectiveProgress}, sm.grade
            FROM missions ms
            JOIN modules m ON m.id = ms.module_id
            {$progressJoin}
            {$where}
            ORDER BY m.level, CASE WHEN ms.type = 'required' THEN 0 ELSE 1 END, ms.sort_order, ms.id
        ");
        $statement->execute($params);

        $stepsByMission = [];
        $stepsStatement = $this->pdo->query("
            SELECT mission_id, instruction
            FROM mission_steps
            ORDER BY mission_id, step_order
        ");
        foreach ($stepsStatement->fetchAll() as $step) {
            $stepsByMission[(int) $step['mission_id']][] = $step['instruction'];
        }

        $supportByMission = [];
        $supportStatement = $this->pdo->query("
            SELECT id, mission_id, original_name, file_size, file_type
            FROM mission_support_files
            WHERE status = 'active'
            ORDER BY mission_id, sort_order, id
        ");
        foreach ($supportStatement->fetchAll() as $file) {
            $supportByMission[(int) $file['mission_id']][] = [
                'id' => (int) $file['id'],
                'name' => $file['original_name'],
                'size' => formatFileSize((int) $file['file_size']),
                'type' => $file['file_type'],
                'downloadUrl' => '/api/index.php?route=mission-files/download&id=' . (int) $file['id'],
            ];
        }

        $prerequisitesByMission = [];
        $prerequisiteStatement = $this->pdo->query("
            SELECT mission_id, prerequisite_mission_id
            FROM mission_prerequisites
            ORDER BY mission_id, prerequisite_mission_id
        ");
        foreach ($prerequisiteStatement->fetchAll() as $prerequisite) {
            $prerequisitesByMission[(int) $prerequisite['mission_id']][] = (int) $prerequisite['prerequisite_mission_id'];
        }

        return array_map(static function (array $row) use ($stepsByMission, $supportByMission, $prerequisitesByMission): array {
            $progress = $row['progress_status'] ?: 'available';
            $missionId = (int) $row['id'];
            $legacySteps = json_decode($row['steps_json'] ?: '[]', true) ?: [];
            return [
                'id' => $missionId,
                'titulo' => $row['title'],
                'objetivo' => $row['objective'],
                'descricao' => $row['description'],
                'modulo' => $row['module_name'],
                'moduloId' => (int) $row['module_id'],
                'aula' => (int) $row['lesson_number'],
                'ordem' => (int) $row['sort_order'],
                'tipo' => $row['type'] === 'required' ? 'obrigatoria' : 'extra',
                'status' => match ($row['status']) {
                    'active' => 'ativa',
                    'draft' => 'rascunho',
                    default => 'arquivada',
                },
                'entrega' => $row['delivery_type'],
                'concluida' => $progress === 'approved',
                'entregue' => $progress === 'submitted',
                'refazer' => $progress === 'redo',
                'situacao' => $progress,
                'emAndamento' => in_array($progress, ['in_progress', 'redo'], true),
                'bloqueada' => $progress === 'blocked',
                'nota' => $row['grade'],
                'joys' => (int) $row['joys_reward'],
                'passos' => $stepsByMission[$missionId] ?? $legacySteps,
                'arquivosApoio' => $supportByMission[$missionId] ?? [],
                'prerequisitoIds' => $prerequisitesByMission[$missionId] ?? [],
            ];
        }, $statement->fetchAll());
    }

    private function submissions(array $viewer): array
    {
        $where = '';
        $params = [];
        if ($viewer['role'] === 'student') {
            $where = 'WHERE sub.student_id = ?';
            $params[] = (int) $viewer['id'];
        } elseif ($viewer['role'] === 'teacher') {
            $where = 'WHERE c.teacher_user_id = ?';
            $params[] = (int) $viewer['id'];
        }

        $statement = $this->pdo->prepare("
            SELECT sub.id, sub.student_id, sub.mission_id, sub.attempt_number, sub.notes, sub.learned,
                   sub.status, sub.feedback, sub.submitted_at, sub.reviewed_at,
                   student.name AS student_name, student.avatar_path AS student_avatar_path,
                   ms.title AS mission_title, c.name AS class_name,
                   GROUP_CONCAT(sf.id ORDER BY sf.id SEPARATOR ',') AS file_ids,
                   GROUP_CONCAT(sf.original_name ORDER BY sf.id SEPARATOR '|||') AS file_names
            FROM submissions sub
            JOIN users student ON student.id = sub.student_id
            JOIN missions ms ON ms.id = sub.mission_id
            LEFT JOIN students sp ON sp.user_id = student.id
            LEFT JOIN classes c ON c.id = sp.class_id
            LEFT JOIN submission_files sf ON sf.submission_id = sub.id
            {$where}
            GROUP BY sub.id, sub.student_id, sub.mission_id, sub.attempt_number, sub.notes, sub.learned,
                     sub.status, sub.feedback, sub.submitted_at, sub.reviewed_at,
                     student.name, student.avatar_path, ms.title, c.name
            ORDER BY sub.submitted_at DESC
        ");
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $fileIds = $row['file_ids'] ? array_map('intval', explode(',', $row['file_ids'])) : [];
            $fileNames = $row['file_names'] ? explode('|||', $row['file_names']) : [];
            $fileDetails = [];
            foreach ($fileNames as $index => $fileName) {
                $fileId = $fileIds[$index] ?? 0;
                $fileDetails[] = [
                    'id' => $fileId,
                    'name' => $fileName,
                    'downloadUrl' => '/api/index.php?route=files/download&id=' . $fileId,
                ];
            }

            return [
                'id' => (int) $row['id'],
                'alunoId' => (int) $row['student_id'],
                'missaoId' => (int) $row['mission_id'],
                'tentativa' => (int) $row['attempt_number'],
                'aluno' => $row['student_name'],
                'alunoFotoUrl' => avatarUrl($row['student_avatar_path'], (int) $row['student_id']),
                'missao' => $row['mission_title'],
                'turma' => $row['class_name'] ?: 'Sem turma',
                'enviadoEm' => date('d/m/Y H:i', strtotime($row['submitted_at'])),
                'status' => match ($row['status']) {
                    'approved' => 'aprovado',
                    'redo' => 'refazer',
                    'concluded' => 'concluido',
                    default => 'pendente',
                },
                'arquivos' => $fileNames,
                'arquivosDetalhes' => $fileDetails,
                'anotacao' => $row['notes'],
                'aprendizado' => $row['learned'],
                'feedback' => $row['feedback'],
            ];
        }, $statement->fetchAll());
    }

    private function medals(array $viewer): array
    {
        $studentId = $viewer['role'] === 'student' ? (int) $viewer['id'] : 0;
        $statement = $this->pdo->prepare("
            SELECT m.id, m.name, m.description, m.icon, m.image_path, m.criteria_type,
                   m.criteria_value, m.joys_reward, m.status, sm.earned_at, sm.notes,
                   CASE WHEN sm.student_id IS NULL THEN 0 ELSE 1 END AS earned
            FROM medals m
            LEFT JOIN student_medals sm ON sm.medal_id = m.id AND sm.student_id = ?
            ORDER BY m.id
        ");
        $statement->execute([$studentId]);

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'nome' => $row['name'],
            'descricao' => $row['description'],
            'icone' => $row['icon'],
            'conquistada' => (bool) $row['earned'],
            'conquistadaEm' => $row['earned_at'] ? date('d/m/Y H:i', strtotime($row['earned_at'])) : null,
            'observacoes' => $row['notes'] ?: '',
            'imagemUrl' => $row['image_path'] ?: null,
            'criterioTipo' => $row['criteria_type'],
            'criterioValor' => $row['criteria_value'] !== null ? (int) $row['criteria_value'] : null,
            'categoria' => AchievementService::categoryLabel((string) $row['criteria_type']),
            'automatica' => AchievementService::isAutomatic((string) $row['criteria_type']),
            'secreta' => $row['criteria_type'] === 'secret_teacher',
            'podeConceder' => AchievementService::canGrant($viewer, (string) $row['criteria_type']),
            'joys' => (int) $row['joys_reward'],
            'status' => $row['status'] === 'active' ? 'ativa' : 'inativa',
        ], $statement->fetchAll());
    }

    private function studentMedalAwards(array $viewer): array
    {
        $where = '';
        $params = [];
        if ($viewer['role'] === 'student') {
            $where = 'WHERE award.student_id = ?';
            $params[] = (int) $viewer['id'];
        } elseif ($viewer['role'] === 'teacher') {
            $where = 'WHERE c.teacher_user_id = ?';
            $params[] = (int) $viewer['id'];
        }

        $statement = $this->pdo->prepare("\n            SELECT award.student_id, award.medal_id, award.notes, award.earned_at,\n                   student.name AS student_name, medal.name AS medal_name,\n                   granter.name AS granted_by_name\n            FROM student_medals award\n            JOIN users student ON student.id = award.student_id\n            JOIN medals medal ON medal.id = award.medal_id\n            LEFT JOIN users granter ON granter.id = award.granted_by\n            LEFT JOIN students profile ON profile.user_id = award.student_id\n            LEFT JOIN classes c ON c.id = profile.class_id\n            {$where}\n            ORDER BY award.earned_at DESC, award.student_id, award.medal_id\n        ");
        $statement->execute($params);

        return array_map(static fn(array $row): array => [
            'studentId' => (int) $row['student_id'],
            'studentName' => $row['student_name'],
            'medalId' => (int) $row['medal_id'],
            'medalName' => $row['medal_name'],
            'notes' => $row['notes'] ?: '',
            'grantedBy' => $row['granted_by_name'] ?: 'Sistema automático',
            'earnedAt' => date('d/m/Y H:i', strtotime($row['earned_at'])),
        ], $statement->fetchAll());
    }

    private function activities(array $viewer): array
    {
        $params = [];
        $where = '';
        $progressJoin = 'LEFT JOIN student_activity_progress progress ON 1 = 0';
        if ($viewer['role'] === 'student') {
            $progressJoin = 'LEFT JOIN student_activity_progress progress ON progress.activity_id = a.id AND progress.student_id = ?';
            $params[] = (int) $viewer['id'];
            $where = "WHERE a.status = 'active'
                AND ms.status = 'active'
                AND ms.module_id = (SELECT current_module_id FROM students WHERE user_id = ?)
                AND (
                    a.type NOT IN ('desafio', 'challenge', 'extra')
                    OR (
                        prerequisite.prerequisite_activity_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM student_activity_progress prerequisite_progress
                            WHERE prerequisite_progress.student_id = ?
                              AND prerequisite_progress.activity_id = prerequisite.prerequisite_activity_id
                              AND prerequisite_progress.status = 'completed'
                        )
                    )
                )";
            $params[] = (int) $viewer['id'];
            $params[] = (int) $viewer['id'];
        }

        $statement = $this->pdo->prepare("
            SELECT a.id, a.mission_id, a.name, a.description, a.type, a.delivery_type,
                   a.criteria, a.sort_order, a.status, ms.title AS mission_name,
                   prerequisite.prerequisite_activity_id, progress.status AS progress_status
            FROM activities a
            JOIN missions ms ON ms.id = a.mission_id
            LEFT JOIN activity_prerequisites prerequisite ON prerequisite.activity_id = a.id
            {$progressJoin}
            {$where}
            ORDER BY a.mission_id,
                     CASE
                         WHEN a.type IN ('desafio', 'challenge', 'extra') THEN 2
                         WHEN a.type IN ('arquivo', 'file') THEN 1
                         ELSE 0
                     END,
                     a.sort_order, a.id
        ");
        $statement->execute($params);
        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'missaoId' => (int) $row['mission_id'],
            'nome' => $row['name'],
            'missao' => $row['mission_name'],
            'tipo' => $row['type'],
            'entrega' => $row['delivery_type'],
            'criterio' => $row['criteria'],
            'descricao' => $row['description'] ?: '',
            'ordem' => (int) $row['sort_order'],
            'status' => $row['status'],
            'prerequisitoId' => $row['prerequisite_activity_id'] ? (int) $row['prerequisite_activity_id'] : null,
            'concluida' => $row['progress_status'] === 'completed',
            'extra' => in_array($row['type'], ['desafio', 'challenge', 'extra'], true),
            'informativa' => in_array($row['type'], ['arquivo', 'file'], true),
        ], $statement->fetchAll());
    }

    private function semesters(): array
    {
        $statement = $this->pdo->query("
            SELECT id, name, start_date, end_date, status
            FROM semesters
            ORDER BY start_date DESC, id DESC
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'startDate' => $row['start_date'],
            'endDate' => $row['end_date'],
            'status' => $row['status'],
        ], $statement->fetchAll());
    }

    private function curriculumLevels(): array
    {
        $statement = $this->pdo->query("
            SELECT id, code, name, sort_order, default_color, status
            FROM curriculum_levels
            ORDER BY sort_order
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'order' => (int) $row['sort_order'],
            'color' => $row['default_color'],
            'status' => $row['status'],
        ], $statement->fetchAll());
    }

    private function labKits(): array
    {
        $items = [];
        $itemStatement = $this->pdo->query("
            SELECT id, kit_id, name, quantity, notes
            FROM lab_kit_items
            ORDER BY kit_id, id
        ");
        foreach ($itemStatement->fetchAll() as $item) {
            $items[(int) $item['kit_id']][] = [
                'id' => (int) $item['id'],
                'name' => $item['name'],
                'quantity' => (int) $item['quantity'],
                'notes' => $item['notes'],
            ];
        }

        $statement = $this->pdo->query("
            SELECT id, code, name, description, status
            FROM lab_kits
            ORDER BY name
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'code' => $row['code'] ?: '',
            'name' => $row['name'],
            'description' => $row['description'],
            'status' => $row['status'],
            'items' => $items[(int) $row['id']] ?? [],
        ], $statement->fetchAll());
    }

    private function kitAssignments(): array
    {
        $statement = $this->pdo->query("
            SELECT assignment.id, assignment.student_id, assignment.kit_id, assignment.module_id,
                   assignment.status, assignment.assigned_at, assignment.returned_at, assignment.notes,
                   student.name AS student_name, kit.name AS kit_name, module.name AS module_name
            FROM student_kit_assignments assignment
            JOIN users student ON student.id = assignment.student_id
            JOIN lab_kits kit ON kit.id = assignment.kit_id
            LEFT JOIN modules module ON module.id = assignment.module_id
            ORDER BY assignment.assigned_at DESC, assignment.id DESC
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'studentId' => (int) $row['student_id'],
            'studentName' => $row['student_name'],
            'kitId' => (int) $row['kit_id'],
            'kitName' => $row['kit_name'],
            'moduleId' => $row['module_id'] !== null ? (int) $row['module_id'] : null,
            'moduleName' => $row['module_name'] ?: 'Sem módulo',
            'status' => $row['status'],
            'assignedAt' => date('d/m/Y H:i', strtotime($row['assigned_at'])),
            'returnedAt' => $row['returned_at'] ? date('d/m/Y H:i', strtotime($row['returned_at'])) : null,
            'notes' => $row['notes'],
        ], $statement->fetchAll());
    }

    private function studentMaterialsForManagement(): array
    {
        $statement = $this->pdo->query("
            SELECT material.id, material.student_id, material.name, material.quantity,
                   material.notes, material.status, student.name AS student_name
            FROM student_materials material
            JOIN users student ON student.id = material.student_id
            ORDER BY student.name, material.name
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'studentId' => (int) $row['student_id'],
            'studentName' => $row['student_name'],
            'name' => $row['name'],
            'quantity' => (int) $row['quantity'],
            'notes' => $row['notes'],
            'status' => $row['status'],
        ], $statement->fetchAll());
    }

    private function pedagogicalNotes(): array
    {
        $statement = $this->pdo->query("
            SELECT note.id, note.student_id, note.author_user_id, note.class_id, note.note,
                   note.visibility, note.status, note.created_at,
                   student.name AS student_name, author.name AS author_name, class.name AS class_name
            FROM pedagogical_notes note
            JOIN users student ON student.id = note.student_id
            JOIN users author ON author.id = note.author_user_id
            LEFT JOIN classes class ON class.id = note.class_id
            WHERE note.status = 'active'
            ORDER BY note.created_at DESC, note.id DESC
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'studentId' => (int) $row['student_id'],
            'studentName' => $row['student_name'],
            'authorId' => (int) $row['author_user_id'],
            'authorName' => $row['author_name'],
            'classId' => $row['class_id'] !== null ? (int) $row['class_id'] : null,
            'className' => $row['class_name'] ?: 'Sem turma',
            'note' => $row['note'],
            'visibility' => $row['visibility'],
            'createdAt' => date('d/m/Y H:i', strtotime($row['created_at'])),
        ], $statement->fetchAll());
    }

    private function auditLogs(): array
    {
        $statement = $this->pdo->query("
            SELECT log.id, log.user_id, log.action, log.entity_type, log.entity_id,
                   log.details_json, log.ip_address, log.created_at, user.name AS user_name
            FROM audit_logs log
            LEFT JOIN users user ON user.id = log.user_id
            ORDER BY log.created_at DESC, log.id DESC
            LIMIT 200
        ");

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'userName' => $row['user_name'] ?: 'Sistema',
            'action' => $row['action'],
            'entityType' => $row['entity_type'],
            'entityId' => $row['entity_id'],
            'details' => $row['details_json'] ? (json_decode($row['details_json'], true) ?: []) : [],
            'ipAddress' => $row['ip_address'],
            'createdAt' => date('d/m/Y H:i', strtotime($row['created_at'])),
        ], $statement->fetchAll());
    }

    private function canViewAudit(array $user): bool
    {
        if ($user['role'] === 'admin') {
            return true;
        }
        $statement = $this->pdo->prepare("
            SELECT COALESCE(
                (SELECT allowed FROM user_permission_overrides WHERE user_id = ? AND permission_code = 'audit.view'),
                EXISTS(SELECT 1 FROM role_permissions WHERE role_code = ? AND permission_code = 'audit.view')
            )
        ");
        $statement->execute([(int) $user['id'], $user['role']]);
        return (bool) $statement->fetchColumn();
    }

    private function studentLabKits(int $studentId): array
    {
        $itemsByKit = [];
        $itemStatement = $this->pdo->query("
            SELECT kit_id, name, quantity
            FROM lab_kit_items
            ORDER BY kit_id, id
        ");
        foreach ($itemStatement->fetchAll() as $item) {
            $label = $item['name'];
            if ((int) $item['quantity'] > 1) {
                $label .= ' (' . (int) $item['quantity'] . 'x)';
            }
            $itemsByKit[(int) $item['kit_id']][] = $label;
        }

        $statement = $this->pdo->prepare("
            SELECT assignment.id, assignment.kit_id, assignment.status, assignment.assigned_at,
                   kit.code, kit.name, kit.description, module.name AS module_name
            FROM student_kit_assignments assignment
            JOIN lab_kits kit ON kit.id = assignment.kit_id
            LEFT JOIN modules module ON module.id = assignment.module_id
            WHERE assignment.student_id = ? AND assignment.status = 'active'
            ORDER BY assignment.assigned_at DESC, assignment.id DESC
        ");
        $statement->execute([$studentId]);

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'kitId' => (int) $row['kit_id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'description' => $row['description'],
            'module' => $row['module_name'],
            'items' => $itemsByKit[(int) $row['kit_id']] ?? [],
            'assignedAt' => $row['assigned_at'],
        ], $statement->fetchAll());
    }

    private function studentMaterials(int $studentId): array
    {
        $statement = $this->pdo->prepare("
            SELECT id, name, quantity, notes, status
            FROM student_materials
            WHERE student_id = ? AND status = 'active'
            ORDER BY name
        ");
        $statement->execute([$studentId]);

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'quantity' => (int) $row['quantity'],
            'notes' => $row['notes'],
            'status' => $row['status'],
        ], $statement->fetchAll());
    }

    private function permissionMatrix(): array
    {
        $rolesStatement = $this->pdo->query("
            SELECT code, name
            FROM roles
            ORDER BY sort_order, code
        ");
        $roles = array_map(static fn(array $row): array => [
            'code' => $row['code'],
            'name' => $row['name'],
        ], $rolesStatement->fetchAll());

        $permissionStatement = $this->pdo->query("
            SELECT p.code, p.name, p.group_name, r.code AS role_code,
                   CASE WHEN rp.permission_code IS NULL THEN 0 ELSE 1 END AS allowed
            FROM permissions p
            CROSS JOIN roles r
            LEFT JOIN role_permissions rp
              ON rp.permission_code = p.code
             AND rp.role_code = r.code
            ORDER BY p.sort_order, p.code, r.sort_order
        ");

        $items = [];
        foreach ($permissionStatement->fetchAll() as $row) {
            $code = $row['code'];
            if (!isset($items[$code])) {
                $items[$code] = [
                    'code' => $code,
                    'name' => $row['name'],
                    'group' => $row['group_name'],
                    'roles' => [],
                ];
            }
            $items[$code]['roles'][$row['role_code']] = (bool) $row['allowed'];
        }

        return [
            'roles' => $roles,
            'items' => array_values($items),
        ];
    }

    private function storeProducts(array $viewer): array
    {
        $where = in_array($viewer['role'], ['supervisor', 'admin'], true) ? '' : "WHERE product.status = 'active'";
        $statement = $this->pdo->query("
            SELECT product.id, product.name, product.description, product.category,
                   product.price_joys, product.image_path, product.inventory_mode,
                   product.stock_quantity, product.status, product.sort_order,
                   (SELECT COUNT(*) FROM store_purchase_requests pending_request
                    WHERE pending_request.product_id = product.id
                      AND pending_request.status = 'pending') AS pending_quantity
            FROM store_products product
            {$where}
            ORDER BY product.sort_order, product.id
        ");

        return array_map(static function (array $row): array {
            $unlimited = $row['inventory_mode'] === 'unlimited';
            $stock = $row['stock_quantity'] === null ? null : (int) $row['stock_quantity'];
            $reserved = $unlimited ? 0 : (int) $row['pending_quantity'];
            $available = $unlimited ? null : max(0, (int) ($stock ?? 0) - $reserved);
            return [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'description' => $row['description'],
                'category' => $row['category'],
                'priceJoys' => (int) $row['price_joys'],
                'imageUrl' => $row['image_path'] ?: null,
                'inventoryMode' => $unlimited ? 'unlimited' : 'limited',
                'stockQuantity' => $stock,
                'reservedQuantity' => $reserved,
                'availableQuantity' => $available,
                'soldOut' => !$unlimited && $available < 1,
                'status' => $row['status'],
                'sortOrder' => (int) $row['sort_order'],
            ];
        }, $statement->fetchAll());
    }

    private function investmentWallet(int $studentId): array
    {
        $balanceStatement = $this->pdo->prepare('SELECT joy_balance FROM students WHERE user_id = ? LIMIT 1');
        $balanceStatement->execute([$studentId]);
        $walletBalance = (int) ($balanceStatement->fetchColumn() ?: 0);

        $todayMovementStatement = $this->pdo->prepare("
            SELECT product_id,
                   SUM(CASE WHEN transaction_type = 'deposit' THEN amount_joys ELSE 0 END) AS deposited_today,
                   SUM(CASE WHEN transaction_type = 'withdraw' THEN amount_joys ELSE 0 END) AS withdrawn_today
            FROM investment_transactions
            WHERE student_id = ? AND created_at >= CURRENT_DATE()
            GROUP BY product_id
        ");
        $todayMovementStatement->execute([$studentId]);
        $todayMovements = [];
        foreach ($todayMovementStatement->fetchAll() as $movement) {
            $todayMovements[(int) $movement['product_id']] = [
                'deposited' => (int) $movement['deposited_today'],
                'withdrawn' => (int) $movement['withdrawn_today'],
            ];
        }

        $statement = $this->pdo->prepare("
            SELECT product.id, product.name, product.description, product.risk_label,
                   product.monthly_rate_basis_points, product.minimum_joys,
                   product.symbol, product.asset_type,
                   product.daily_drift_basis_points, product.daily_volatility_basis_points,
                   product.market_seed, product.market_anchor_date, product.market_anchor_price,
                   COALESCE(investment_position.principal_joys, 0) AS principal_joys,
                   COALESCE(investment_position.accrued_joys, 0) AS accrued_joys,
                   investment_position.last_accrual_at, investment_position.units
            FROM investment_products product
            LEFT JOIN student_investments investment_position
              ON investment_position.product_id = product.id
             AND investment_position.student_id = ?
            WHERE product.status = 'active'
            ORDER BY product.sort_order, product.id
        ");
        $statement->execute([$studentId]);
        $products = array_map(static function (array $row) use ($todayMovements): array {
            $principal = (int) $row['principal_joys'];
            $market = investmentMarketSnapshot($row);
            $units = investmentPositionUnits($row, (float) $market['currentPrice']);
            $marketValue = $units * (float) $market['currentPrice'];
            $profitLoss = $marketValue - $principal;
            $averagePrice = $units > 0 ? $principal / $units : 0.0;
            $productId = (int) $row['id'];
            $currentPrice = (float) $market['currentPrice'];
            $marketHistory = $market['history'];
            $previousPrice = count($marketHistory) >= 2
                ? (float) $marketHistory[count($marketHistory) - 2]['price']
                : $currentPrice;
            $movement = $todayMovements[$productId] ?? ['deposited' => 0, 'withdrawn' => 0];
            // A cotação muda uma vez por dia. Aportes e retiradas feitos hoje usam
            // a cotação atual e, portanto, não recebem a oscilação ocorrida antes
            // da compra. As cotas que já existiam no fechamento anterior recebem.
            $openingUnits = $currentPrice > 0
                ? max(0.0, $units - ($movement['deposited'] / $currentPrice) + ($movement['withdrawn'] / $currentPrice))
                : 0.0;
            $todayOpeningValue = $openingUnits * $previousPrice;
            $todayProfitLoss = $openingUnits * ($currentPrice - $previousPrice);
            return [
                'id' => $productId,
                'name' => $row['name'],
                'description' => $row['description'],
                'riskLabel' => $row['risk_label'],
                'symbol' => $row['symbol'],
                'assetType' => $row['asset_type'],
                'minimumJoys' => (int) $row['minimum_joys'],
                'principalJoys' => $principal,
                'units' => round($units, 8),
                'currentPrice' => $market['currentPrice'],
                'marketValueJoys' => round($marketValue, 4),
                'profitLossJoys' => round($profitLoss, 4),
                'profitLossPercent' => $principal > 0 ? round(($profitLoss / $principal) * 100, 2) : 0.0,
                'todayOpeningValueJoys' => round($todayOpeningValue, 4),
                'todayProfitLossJoys' => round($todayProfitLoss, 4),
                'todayProfitLossPercent' => $todayOpeningValue > 0
                    ? round(($todayProfitLoss / $todayOpeningValue) * 100, 2)
                    : 0.0,
                'averagePrice' => round($averagePrice, 4),
                'availableJoys' => (int) floor(max(0, $marketValue)),
                'changeDay' => $market['changeDay'],
                'changeWeek' => $market['changeWeek'],
                'changeMonth' => $market['changeMonth'],
                'history' => $market['history'],
            ];
        }, $statement->fetchAll());

        $transactions = $this->pdo->prepare("
            SELECT investment_tx.id, investment_tx.transaction_type, investment_tx.amount_joys,
                   investment_tx.principal_after, investment_tx.earnings_after,
                   investment_tx.joy_balance_after, investment_tx.created_at,
                   product.name AS product_name
            FROM investment_transactions investment_tx
            JOIN investment_products product ON product.id = investment_tx.product_id
            WHERE investment_tx.student_id = ?
            ORDER BY investment_tx.created_at DESC, investment_tx.id DESC
            LIMIT 100
        ");
        $transactions->execute([$studentId]);

        return [
            'walletBalance' => $walletBalance,
            'products' => $products,
            'transactions' => array_map(static fn(array $row): array => [
                'id' => (int) $row['id'],
                'type' => $row['transaction_type'],
                'amountJoys' => (int) $row['amount_joys'],
                'principalAfter' => (int) $row['principal_after'],
                'earningsAfter' => round((float) $row['earnings_after'], 4),
                'balanceAfter' => (int) $row['joy_balance_after'],
                'productName' => $row['product_name'],
                'createdAt' => date('d/m/Y H:i', strtotime($row['created_at'])),
            ], $transactions->fetchAll()),
        ];
    }

    private function storeRequests(array $viewer): array
    {
        if ($viewer['role'] === 'teacher') {
            return [];
        }
        $where = '';
        $params = [];
        if ($viewer['role'] === 'student') {
            $where = 'WHERE request.student_id = ?';
            $params[] = (int) $viewer['id'];
        } elseif (!in_array($viewer['role'], ['supervisor', 'admin'], true)) {
            return [];
        }

        $statement = $this->pdo->prepare("
            SELECT request.id, request.student_id, request.product_id, request.product_name,
                   request.total_joys, request.request_details, request.status,
                   request.review_notes, request.requested_at, request.reviewed_at,
                   student.name AS student_name, student_profile.joy_balance,
                   reviewer.name AS reviewer_name
            FROM store_purchase_requests request
            JOIN users student ON student.id = request.student_id
            JOIN students student_profile ON student_profile.user_id = student.id
            LEFT JOIN users reviewer ON reviewer.id = request.reviewed_by
            {$where}
            ORDER BY CASE request.status WHEN 'pending' THEN 0 ELSE 1 END,
                     request.requested_at DESC, request.id DESC
        ");
        $statement->execute($params);

        return array_map(static fn(array $row): array => [
            'id' => (int) $row['id'],
            'studentId' => (int) $row['student_id'],
            'studentName' => $row['student_name'],
            'studentBalance' => (int) $row['joy_balance'],
            'productId' => (int) $row['product_id'],
            'productName' => $row['product_name'],
            'totalJoys' => (int) $row['total_joys'],
            'details' => $row['request_details'],
            'status' => $row['status'],
            'reviewNotes' => $row['review_notes'] ?: '',
            'reviewerName' => $row['reviewer_name'] ?: null,
            'requestedAt' => date('d/m/Y H:i', strtotime($row['requested_at'])),
            'reviewedAt' => $row['reviewed_at'] ? date('d/m/Y H:i', strtotime($row['reviewed_at'])) : null,
        ], $statement->fetchAll());
    }

    private function managementAnalytics(): array
    {
        $genderRow = $this->pdo->query("
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN student.gender = 'male' THEN 1 ELSE 0 END) AS male_count,
                   SUM(CASE WHEN student.gender = 'female' THEN 1 ELSE 0 END) AS female_count,
                   SUM(CASE WHEN student.gender IS NULL OR student.gender NOT IN ('male', 'female') THEN 1 ELSE 0 END) AS not_informed_count
            FROM students student
            JOIN users user_account ON user_account.id = student.user_id
            WHERE user_account.role = 'student'
        ")->fetch() ?: [];

        $storeRow = $this->pdo->query("
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                   SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                   SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
                   SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
            FROM store_purchase_requests
        ")->fetch() ?: [];

        $topProducts = $this->pdo->query("
            SELECT product_id, product_name,
                   COUNT(*) AS approved_quantity
            FROM store_purchase_requests
            WHERE status = 'approved'
            GROUP BY product_id, product_name
            ORDER BY approved_quantity DESC, product_name ASC
            LIMIT 5
        ")->fetchAll();

        return [
            'gender' => [
                'total' => (int) ($genderRow['total'] ?? 0),
                'male' => (int) ($genderRow['male_count'] ?? 0),
                'female' => (int) ($genderRow['female_count'] ?? 0),
                'notInformed' => (int) ($genderRow['not_informed_count'] ?? 0),
            ],
            'store' => [
                'total' => (int) ($storeRow['total'] ?? 0),
                'approved' => (int) ($storeRow['approved_count'] ?? 0),
                'pending' => (int) ($storeRow['pending_count'] ?? 0),
                'rejected' => (int) ($storeRow['rejected_count'] ?? 0),
                'cancelled' => (int) ($storeRow['cancelled_count'] ?? 0),
            ],
            'topProducts' => array_map(static fn(array $row): array => [
                'productId' => (int) $row['product_id'],
                'name' => $row['product_name'],
                'approvedQuantity' => (int) $row['approved_quantity'],
            ], $topProducts),
        ];
    }

    private function emptyReenrollmentData(array $students): array
    {
        $contracts = array_map(static fn(array $student): array => [
            'id' => null,
            'studentId' => (int) $student['id'],
            'studentName' => $student['name'],
            'studentEmail' => $student['email'],
            'studentStatus' => $student['status'] ?? 'ativo',
            'className' => $student['turma'] ?? 'Sem turma',
            'guardianName' => '',
            'guardianPhone' => '',
            'signedAt' => null,
            'startDate' => null,
            'endDate' => null,
            'durationMonths' => null,
            'paymentMethod' => null,
            'paymentCycleEndDate' => null,
            'enrollmentFeeRequired' => null,
            'enrollmentFeeNextDate' => null,
            'enrollmentFeeDaysToExpiry' => null,
            'billingAction' => 'none',
            'contractStatus' => 'blank',
            'renewalStatus' => 'not_started',
            'notes' => '',
            'rescindedAt' => null,
            'rescissionReason' => '',
            'daysToExpiry' => null,
            'paymentDaysToExpiry' => null,
            'sourceImported' => false,
            'sourceLabel' => null,
            'sourcePage' => null,
            'legacy' => null,
            'followups' => [],
            'reminders' => [],
        ], $students);

        return [
            'available' => false,
            'contracts' => $contracts,
            'notifications' => [],
            'analytics' => [
                'totalStudents' => count($contracts),
                'blank' => count($contracts),
                'active' => 0,
                'pending' => 0,
                'renewalDue' => 0,
                'expired' => 0,
                'rescinded' => 0,
                'boletoDue' => 0,
                'cardDue' => 0,
                'enrollmentFeeDue' => 0,
                'overdueReminders' => 0,
                'paymentMethods' => ['card' => 0, 'boleto' => 0, 'cash' => 0, 'other' => 0, 'not_informed' => count($contracts)],
            ],
        ];
    }

    private function databaseColumnExists(string $table, string $column): bool
    {
        $statement = $this->pdo->prepare("
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
        ");
        $statement->execute([$table, $column]);
        return (bool) $statement->fetchColumn();
    }

    private function cleanupExpiredFinancialAttachments(): void
    {
        if (!$this->databaseColumnExists('contract_reminders', 'attachment_stored_name')
            || !$this->databaseColumnExists('contract_reminders', 'attachment_delete_after')) {
            return;
        }

        $rows = $this->pdo->query("
            SELECT id, attachment_stored_name
            FROM contract_reminders
            WHERE attachment_stored_name IS NOT NULL
              AND attachment_delete_after IS NOT NULL
              AND attachment_delete_after <= CURDATE()
            LIMIT 100
        ")->fetchAll();
        if (!$rows) return;

        $uploadRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'uploads';
        $resolvedRoot = realpath($uploadRoot);
        foreach ($rows as $row) {
            $storedName = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string) $row['attachment_stored_name']);
            $candidate = $uploadRoot . DIRECTORY_SEPARATOR . ltrim($storedName, DIRECTORY_SEPARATOR);
            $resolvedFile = realpath($candidate);
            if ($resolvedRoot && $resolvedFile
                && str_starts_with($resolvedFile, $resolvedRoot . DIRECTORY_SEPARATOR)
                && is_file($resolvedFile)) {
                @unlink($resolvedFile);
            }
            $statement = $this->pdo->prepare("
                UPDATE contract_reminders
                SET attachment_original_name = NULL,
                    attachment_stored_name = NULL,
                    attachment_mime_type = NULL,
                    attachment_file_size = NULL,
                    attachment_uploaded_at = NULL,
                    attachment_deleted_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $statement->execute([(int) $row['id']]);
        }
    }

    /**
     * O Financeiro recebe somente os totais e os campos necessários para
     * emitir carnês/boletos e taxas. O responsável da cobrança aparece somente
     * dentro da tarefa financeira; follow-ups, observações gerais e edição
     * contratual permanecem restritos à gestão de rematrícula.
     */
    private function financialReenrollmentData(): array
    {
        $data = $this->reenrollmentData();
        $financialTypes = ['issue_boleto', 'issue_enrollment_fee'];

        $data['contracts'] = array_map(static function (array $contract) use ($financialTypes): array {
            $financialReminders = array_values(array_filter(
                $contract['reminders'] ?? [],
                static fn(array $reminder): bool => in_array($reminder['type'] ?? '', $financialTypes, true)
            ));

            return [
                'studentId' => $contract['studentId'],
                'studentName' => $contract['studentName'],
                'className' => $contract['className'],
                'paymentMethod' => $contract['paymentMethod'],
                'paymentCycleEndDate' => $contract['paymentCycleEndDate'],
                'enrollmentFeeRequired' => $contract['enrollmentFeeRequired'],
                'enrollmentFeeNextDate' => $contract['enrollmentFeeNextDate'],
                'enrollmentFeeDaysToExpiry' => $contract['enrollmentFeeDaysToExpiry'],
                'billingAction' => $contract['billingAction'],
                'contractStatus' => $contract['contractStatus'],
                'renewalStatus' => $contract['renewalStatus'],
                'daysToExpiry' => $contract['daysToExpiry'],
                'paymentDaysToExpiry' => $contract['paymentDaysToExpiry'],
                'reminders' => $financialReminders,
            ];
        }, $data['contracts'] ?? []);

        $financialReminderIds = [];
        foreach ($data['contracts'] as $contract) {
            foreach ($contract['reminders'] as $reminder) {
                $financialReminderIds[(int) $reminder['id']] = true;
            }
        }
        $data['notifications'] = array_values(array_filter(
            $data['notifications'] ?? [],
            static function (array $notification) use ($financialReminderIds): bool {
                if (!str_starts_with((string) ($notification['key'] ?? ''), 'contract-reminder:')) {
                    return false;
                }
                $parts = explode(':', (string) $notification['key']);
                return isset($financialReminderIds[(int) ($parts[1] ?? 0)]);
            }
        ));

        return $data;
    }

    private function reenrollmentData(): array
    {
        $hasEnrollmentFeeRequired = $this->databaseColumnExists('student_contracts', 'enrollment_fee_required');
        $hasEnrollmentFeeDate = $this->databaseColumnExists('student_contracts', 'enrollment_fee_next_date');
        $enrollmentFeeRequiredExpression = $hasEnrollmentFeeRequired ? 'contract.enrollment_fee_required' : 'NULL';
        $enrollmentFeeDateExpression = $hasEnrollmentFeeDate ? 'contract.enrollment_fee_next_date' : 'NULL';
        $followupRows = $this->pdo->query("
            SELECT followup.id, followup.contract_id, followup.student_id, followup.contact_at,
                   followup.channel, followup.sent_message, followup.guardian_response,
                   followup.next_action, followup.created_at, creator.name AS creator_name
            FROM contract_followups followup
            LEFT JOIN users creator ON creator.id = followup.created_by
            ORDER BY COALESCE(followup.contact_at, followup.created_at) DESC, followup.id DESC
        ")->fetchAll();
        $followups = [];
        foreach ($followupRows as $row) {
            $studentId = (int) $row['student_id'];
            $followups[$studentId][] = [
                'id' => (int) $row['id'],
                'contractId' => (int) $row['contract_id'],
                'studentId' => $studentId,
                'contactAt' => $row['contact_at'],
                'channel' => $row['channel'],
                'sentMessage' => $row['sent_message'] ?: '',
                'guardianResponse' => $row['guardian_response'] ?: '',
                'nextAction' => $row['next_action'] ?: '',
                'creatorName' => $row['creator_name'] ?: 'Importação histórica',
                'createdAt' => $row['created_at'],
            ];
        }

        $reminderRows = $this->pdo->query("
            SELECT reminder.id, reminder.contract_id, reminder.student_id, reminder.reminder_type,
                   reminder.title, reminder.due_at, reminder.notes, reminder.status,
                   reminder.completed_at, reminder.created_at, creator.name AS creator_name,
                   reminder.financial_responsible_name, reminder.billing_installments,
                   reminder.billing_first_due_date, reminder.billing_due_day,
                   reminder.sponte_registered, reminder.attachment_original_name,
                   reminder.attachment_stored_name, reminder.attachment_file_size,
                   reminder.attachment_uploaded_at, reminder.attachment_delete_after,
                   reminder.attachment_deleted_at
            FROM contract_reminders reminder
            LEFT JOIN users creator ON creator.id = reminder.created_by
            ORDER BY CASE reminder.status WHEN 'pending' THEN 0 ELSE 1 END,
                     reminder.due_at ASC, reminder.id DESC
        ")->fetchAll();
        $reminders = [];
        $notifications = [];
        $now = new DateTimeImmutable();
        $today = new DateTimeImmutable('today');
        $notificationLimit = $now->modify('+30 days');
        $oneMonthContractLimit = $today->modify('+1 month');
        $twoMonthContractLimit = $today->modify('+2 months');
        $overdueReminderCount = 0;
        foreach ($reminderRows as $row) {
            $studentId = (int) $row['student_id'];
            $dueAt = new DateTimeImmutable($row['due_at']);
            $isOverdue = $row['status'] === 'pending' && $dueAt < $now;
            if ($isOverdue) $overdueReminderCount++;
            $reminders[$studentId][] = [
                'id' => (int) $row['id'],
                'contractId' => (int) $row['contract_id'],
                'studentId' => $studentId,
                'type' => $row['reminder_type'],
                'title' => $row['title'],
                'dueAt' => $row['due_at'],
                'notes' => $row['notes'] ?: '',
                'status' => $row['status'],
                'isOverdue' => $isOverdue,
                'completedAt' => $row['completed_at'],
                'creatorName' => $row['creator_name'] ?: '',
                'createdAt' => $row['created_at'],
                'responsibleName' => $row['financial_responsible_name'] ?: '',
                'installmentCount' => $row['billing_installments'] !== null ? (int) $row['billing_installments'] : null,
                'firstDueDate' => $row['billing_first_due_date'],
                'dueDay' => $row['billing_due_day'] !== null ? (int) $row['billing_due_day'] : null,
                'sponteRegistered' => $row['sponte_registered'] === null ? null : (bool) $row['sponte_registered'],
                'attachment' => $row['attachment_stored_name'] ? [
                    'name' => $row['attachment_original_name'] ?: 'carne-boletos.pdf',
                    'size' => (int) ($row['attachment_file_size'] ?? 0),
                    'uploadedAt' => $row['attachment_uploaded_at'],
                    'deleteAfter' => $row['attachment_delete_after'],
                    'downloadUrl' => '/api/index.php?route=admin%2Freenrollment%2Freminder%2Ffile&id=' . (int) $row['id'],
                ] : null,
                'attachmentDeletedAt' => $row['attachment_deleted_at'],
            ];
            if ($row['status'] === 'pending' && $dueAt <= $notificationLimit) {
                $notifications[] = [
                    'key' => 'contract-reminder:' . (int) $row['id'] . ':' . $row['due_at'],
                    'title' => $isOverdue ? 'Lembrete de rematrícula atrasado' : $row['title'],
                    'text' => '',
                    'meta' => $dueAt->format('d/m/Y H:i'),
                    'page' => 'reenrollment',
                    'icon' => $isOverdue ? 'alertTriangle' : 'calendar',
                    'studentId' => $studentId,
                    'dueAt' => $row['due_at'],
                    'isOverdue' => $isOverdue,
                ];
            }
        }

        $statement = $this->pdo->query("
            SELECT user_account.id AS student_id, user_account.name AS student_name,
                   user_account.email AS student_email, user_account.status AS user_status,
                   student.guardian_name, student.guardian_phone, class.name AS class_name,
                   contract.id AS contract_id, contract.contract_signed_at, contract.contract_start_date,
                   contract.contract_end_date, contract.duration_months, contract.payment_method,
                   contract.payment_cycle_end_date,
                   {$enrollmentFeeRequiredExpression} AS enrollment_fee_required,
                   {$enrollmentFeeDateExpression} AS enrollment_fee_next_date,
                   contract.billing_action, contract.contract_status,
                   contract.renewal_status, contract.notes, contract.rescinded_at,
                   contract.rescission_reason, contract.legacy_payment_initial,
                   contract.legacy_contract, contract.legacy_followup,
                   contract.legacy_payment_second_semester, contract.legacy_status,
                   contract.source_label, contract.source_page, contract.source_imported
            FROM users user_account
            JOIN students student ON student.user_id = user_account.id
            LEFT JOIN classes class ON class.id = student.class_id
            LEFT JOIN student_contracts contract ON contract.student_id = user_account.id
            WHERE user_account.role = 'student'
            ORDER BY user_account.name ASC
        ");

        $analytics = [
            'totalStudents' => 0,
            'blank' => 0,
            'active' => 0,
            'pending' => 0,
            'renewalDue' => 0,
            'expired' => 0,
            'rescinded' => 0,
            'boletoDue' => 0,
            'cardDue' => 0,
            'enrollmentFeeDue' => 0,
            'overdueReminders' => $overdueReminderCount,
            'paymentMethods' => ['card' => 0, 'boleto' => 0, 'cash' => 0, 'other' => 0, 'not_informed' => 0],
        ];
        $contracts = [];
        $notificationNames = [];
        $billingStudents = ['issue_boleto' => [], 'charge_card' => []];
        $enrollmentFeeStudents = [];
        foreach ($statement->fetchAll() as $row) {
            $studentId = (int) $row['student_id'];
            $status = $row['contract_status'] ?: 'blank';
            $paymentMethod = $row['payment_method'] ?: null;
            $daysToExpiry = null;
            $paymentDaysToExpiry = null;
            $enrollmentFeeDaysToExpiry = null;
            if ($row['contract_end_date']) {
                $endDate = new DateTimeImmutable($row['contract_end_date']);
                $daysToExpiry = (int) $today->diff($endDate)->format('%r%a');
                if (!in_array($status, ['rescinded', 'not_renewing'], true) && $daysToExpiry < 0) {
                    $analytics['expired']++;
                } elseif (!in_array($status, ['rescinded', 'not_renewing'], true) && $daysToExpiry <= 31) {
                    $analytics['renewalDue']++;
                }
                if (!in_array($status, ['rescinded', 'not_renewing'], true) && $endDate <= $twoMonthContractLimit) {
                    $noticeStage = $daysToExpiry < 0
                        ? 'expired'
                        : ($endDate <= $oneMonthContractLimit ? 'one-month' : 'two-months');
                    $noticeTitle = match ($noticeStage) {
                        'expired' => 'Contrato vencido',
                        'one-month' => 'Contrato vence em até 1 mês',
                        default => 'Contrato vence em até 2 meses',
                    };
                    $notifications[] = [
                        'key' => 'contract-expiry:' . $studentId . ':' . $row['contract_end_date'] . ':' . $noticeStage,
                        'title' => $noticeTitle,
                        'text' => $row['student_name'],
                        'meta' => $daysToExpiry < 0
                            ? 'Venceu em ' . $endDate->format('d/m/Y')
                            : 'Vence em ' . $endDate->format('d/m/Y') . ' · ' . $daysToExpiry . ' dia' . ($daysToExpiry === 1 ? '' : 's'),
                        'page' => 'reenrollment',
                        'icon' => $daysToExpiry < 0 ? 'alertTriangle' : 'calendar',
                        'studentId' => $studentId,
                        'dueAt' => $row['contract_end_date'] . ' 23:59:59',
                        'isOverdue' => $daysToExpiry < 0,
                    ];
                }
            }
            if ($row['payment_cycle_end_date'] && !in_array($status, ['rescinded', 'not_renewing'], true)) {
                $paymentEndDate = new DateTimeImmutable($row['payment_cycle_end_date']);
                $paymentDaysToExpiry = (int) $today->diff($paymentEndDate)->format('%r%a');
                if ($paymentDaysToExpiry <= 31) {
                    $billingKey = $paymentMethod === 'boleto' ? 'issue_boleto' : ($paymentMethod === 'card' ? 'charge_card' : null);
                    if ($billingKey !== null) $billingStudents[$billingKey][$studentId] = true;
                }
                if ($paymentEndDate <= $twoMonthContractLimit) {
                    $paymentNoticeStage = $paymentDaysToExpiry < 0
                        ? 'expired'
                        : ($paymentEndDate <= $oneMonthContractLimit ? 'one-month' : 'two-months');
                    $paymentNoticeTitle = match ($paymentMethod) {
                        'boleto' => match ($paymentNoticeStage) {
                            'expired' => 'Ciclo de boletos vencido',
                            'one-month' => 'Gerar boletos em até 1 mês',
                            default => 'Boletos terminam em até 2 meses',
                        },
                        'card' => match ($paymentNoticeStage) {
                            'expired' => 'Cartão precisa ser renovado',
                            'one-month' => 'Passar cartão em até 1 mês',
                            default => 'Cartão termina em até 2 meses',
                        },
                        default => match ($paymentNoticeStage) {
                            'expired' => 'Ciclo de pagamento vencido',
                            'one-month' => 'Pagamento vence em até 1 mês',
                            default => 'Pagamento vence em até 2 meses',
                        },
                    };
                    $notifications[] = [
                        'key' => 'payment-cycle:' . $studentId . ':' . $row['payment_cycle_end_date'] . ':' . $paymentNoticeStage,
                        'title' => $paymentNoticeTitle,
                        'text' => $row['student_name'],
                        'meta' => ($paymentDaysToExpiry < 0 ? 'Pagamento venceu em ' : 'Pagamento termina em ') . $paymentEndDate->format('d/m/Y'),
                        'page' => 'reenrollment',
                        'icon' => $paymentDaysToExpiry < 0 ? 'alertTriangle' : 'calendar',
                        'studentId' => $studentId,
                        'dueAt' => $row['payment_cycle_end_date'] . ' 23:59:59',
                        'isOverdue' => $paymentDaysToExpiry < 0,
                    ];
                }
            }
            if ((int) ($row['enrollment_fee_required'] ?? 0) === 1
                && $row['enrollment_fee_next_date']
                && !in_array($status, ['rescinded', 'not_renewing'], true)) {
                $enrollmentFeeDate = new DateTimeImmutable($row['enrollment_fee_next_date']);
                $enrollmentFeeDaysToExpiry = (int) $today->diff($enrollmentFeeDate)->format('%r%a');
                if ($enrollmentFeeDate <= $twoMonthContractLimit) {
                    $enrollmentFeeStudents[$studentId] = true;
                    $feeNoticeStage = $enrollmentFeeDaysToExpiry < 0
                        ? 'expired'
                        : ($enrollmentFeeDate <= $oneMonthContractLimit ? 'one-month' : 'two-months');
                    $feeNoticeTitle = match ($feeNoticeStage) {
                        'expired' => 'Taxa de matrícula vencida',
                        'one-month' => 'Taxa de matrícula vence em até 1 mês',
                        default => 'Taxa de matrícula vence em até 2 meses',
                    };
                    $notifications[] = [
                        'key' => 'enrollment-fee:' . $studentId . ':' . $row['enrollment_fee_next_date'] . ':' . $feeNoticeStage,
                        'title' => $feeNoticeTitle,
                        'text' => $row['student_name'],
                        'meta' => ($enrollmentFeeDaysToExpiry < 0 ? 'Taxa venceu em ' : 'Próxima taxa em ') . $enrollmentFeeDate->format('d/m/Y'),
                        'page' => 'reenrollment',
                        'icon' => $enrollmentFeeDaysToExpiry < 0 ? 'alertTriangle' : 'calendar',
                        'studentId' => $studentId,
                        'dueAt' => $row['enrollment_fee_next_date'] . ' 23:59:59',
                        'isOverdue' => $enrollmentFeeDaysToExpiry < 0,
                    ];
                }
            }
            $analytics['totalStudents']++;
            if ($status === 'blank') $analytics['blank']++;
            if ($status === 'active') $analytics['active']++;
            if (in_array($status, ['pending', 'renewal_due'], true)) $analytics['pending']++;
            if (in_array($status, ['rescinded', 'not_renewing'], true)) $analytics['rescinded']++;
            $paymentKey = in_array($paymentMethod, ['card', 'boleto', 'cash'], true)
                ? $paymentMethod : ($paymentMethod ? 'other' : 'not_informed');
            $analytics['paymentMethods'][$paymentKey]++;
            if (isset($billingStudents[$row['billing_action']])) {
                $billingStudents[$row['billing_action']][$studentId] = true;
            }

            $contracts[] = [
                'id' => $row['contract_id'] ? (int) $row['contract_id'] : null,
                'studentId' => $studentId,
                'studentName' => $row['student_name'],
                'studentEmail' => $row['student_email'],
                'studentStatus' => $row['user_status'] === 'active' ? 'ativo' : 'inativo',
                'className' => $row['class_name'] ?: 'Sem turma',
                'guardianName' => $row['guardian_name'] ?: '',
                'guardianPhone' => $row['guardian_phone'] ?: '',
                'signedAt' => $row['contract_signed_at'],
                'startDate' => $row['contract_start_date'],
                'endDate' => $row['contract_end_date'],
                'durationMonths' => $row['duration_months'] !== null ? (int) $row['duration_months'] : null,
                'paymentMethod' => $paymentMethod,
                'paymentCycleEndDate' => $row['payment_cycle_end_date'],
                'enrollmentFeeRequired' => $row['enrollment_fee_required'] === null ? null : (bool) $row['enrollment_fee_required'],
                'enrollmentFeeNextDate' => $row['enrollment_fee_next_date'],
                'enrollmentFeeDaysToExpiry' => $enrollmentFeeDaysToExpiry,
                'billingAction' => $row['billing_action'] ?: 'none',
                'contractStatus' => $status,
                'renewalStatus' => $row['renewal_status'] ?: 'not_started',
                'notes' => $row['notes'] ?: '',
                'rescindedAt' => $row['rescinded_at'],
                'rescissionReason' => $row['rescission_reason'] ?: '',
                'daysToExpiry' => $daysToExpiry,
                'paymentDaysToExpiry' => $paymentDaysToExpiry,
                'sourceImported' => (bool) $row['source_imported'],
                'sourceLabel' => $row['source_label'] ?: null,
                'sourcePage' => $row['source_page'] !== null ? (int) $row['source_page'] : null,
                'legacy' => (bool) $row['source_imported'] ? [
                    'paymentInitial' => $row['legacy_payment_initial'] ?: '',
                    'contract' => $row['legacy_contract'] ?: '',
                    'followup' => $row['legacy_followup'] ?: '',
                    'paymentSecondSemester' => $row['legacy_payment_second_semester'] ?: '',
                    'status' => $row['legacy_status'] ?: '',
                ] : null,
                'followups' => $followups[$studentId] ?? [],
                'reminders' => $reminders[$studentId] ?? [],
            ];
            $notificationNames[$studentId] = $row['student_name'];
        }
        $analytics['boletoDue'] = count($billingStudents['issue_boleto']);
        $analytics['cardDue'] = count($billingStudents['charge_card']);
        $analytics['enrollmentFeeDue'] = count($enrollmentFeeStudents);

        foreach ($notifications as &$notification) {
            if ($notification['text'] === '' && isset($notificationNames[$notification['studentId']])) {
                $notification['text'] = $notificationNames[$notification['studentId']];
            }
        }
        unset($notification);
        usort($notifications, static fn(array $left, array $right): int => strcmp(
            (string) ($left['dueAt'] ?? ''),
            (string) ($right['dueAt'] ?? '')
        ));

        return [
            'available' => true,
            'contracts' => $contracts,
            'notifications' => $notifications,
            'analytics' => $analytics,
        ];
    }

    private function studentFiles(int $studentId): array
    {
        $statement = $this->pdo->prepare("
            SELECT sf.id, sf.original_name, sf.file_type, sf.file_size,
                   ms.title AS mission_title, sub.submitted_at, sub.status
            FROM submission_files sf
            JOIN submissions sub ON sub.id = sf.submission_id
            JOIN missions ms ON ms.id = sub.mission_id
            WHERE sub.student_id = ?
            ORDER BY sub.submitted_at DESC, sf.id DESC
        ");
        $statement->execute([$studentId]);

        return array_map(static function (array $row): array {
            $extension = strtolower(pathinfo($row['original_name'], PATHINFO_EXTENSION));
            $type = match (true) {
                in_array($extension, ['ino', 'cpp', 'c', 'h'], true) => 'code',
                $extension === 'stl' => 'stl',
                $extension === 'pdf' => 'pdf',
                in_array($extension, ['png', 'jpg', 'jpeg'], true) => 'image',
                default => 'code',
            };
            return [
                'id' => (int) $row['id'],
                'name' => $row['original_name'],
                'type' => $type,
                'missao' => $row['mission_title'],
                'enviado' => date('d/m/Y H:i', strtotime($row['submitted_at'])),
                'size' => formatFileSize((int) $row['file_size']),
                'status' => match ($row['status']) {
                    'approved', 'concluded' => 'aprovado',
                    'redo' => 'refazer',
                    default => 'pendente',
                },
                'downloadUrl' => '/api/index.php?route=files/download&id=' . (int) $row['id'],
            ];
        }, $statement->fetchAll());
    }
}
