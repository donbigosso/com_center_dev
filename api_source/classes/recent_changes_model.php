<?php
require_once __DIR__ . '/log_model.php';

class RecentChangesModel
{
    private const MAX_CHANGE_LENGTH = 500;

    private DatabaseAccess $db;

    public function __construct(DatabaseAccess $db)
    {
        $this->db = $db;
    }

    /**
     * Public list of recent changes, newest date first.
     *
     * @return array{success:bool,message:string,error:string,changes:array}
     */
    public function list_recent_changes(): array
    {
        $rows = $this->db->queryAll(
            'SELECT id, `date`, changes_made
             FROM recent_changes
             ORDER BY `date` DESC, id DESC'
        );

        return [
            'success' => true,
            'message' => 'Recent changes retrieved.',
            'error' => '',
            'changes' => array_map([$this, 'map_row'], $rows),
        ];
    }

    /**
     * Admin: add a recent-change row.
     * Body: token, date (YYYY-MM-DD), changes_made.
     *
     * @return array{success:bool,message:string,error:string,change:?array}
     */
    public function create_recent_change(array $input): array
    {
        $actor = $this->actor_from_token((string)($input['token'] ?? ''));
        $ok = false;
        $logDetail = '';
        try {
            $admin = (new UserModel($this->db))->verify_admin_by_token($input);
            if (!$admin['success']) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Admin token required.',
                    'change' => null,
                ];
            }

            $parsed = $this->parse_fields($input);
            if ($parsed['error'] !== '') {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => $parsed['error'],
                    'change' => null,
                ];
            }

            $id = (int)$this->db->insert('recent_changes', [
                'date' => $parsed['date'],
                'changes_made' => $parsed['changes_made'],
            ]);
            if ($id < 1) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Failed to save recent change.',
                    'change' => null,
                ];
            }

            $ok = true;
            $logDetail = LogModel::id_detail($id);
            return [
                'success' => true,
                'message' => 'Recent change added.',
                'error' => '',
                'change' => [
                    'id' => $id,
                    'date' => $parsed['date'],
                    'changes_made' => $parsed['changes_made'],
                ],
            ];
        } finally {
            (new LogModel())->record_result(
                'create recent change - admin',
                $ok,
                $actor,
                $logDetail
            );
        }
    }

    /**
     * Admin: update date and/or text of a recent-change row.
     * Body: token, id, optional date, optional changes_made.
     *
     * @return array{success:bool,message:string,error:string,change:?array}
     */
    public function update_recent_change(array $input): array
    {
        $actor = $this->actor_from_token((string)($input['token'] ?? ''));
        $ok = false;
        $id = (int)($input['id'] ?? 0);
        $logDetail = LogModel::id_detail($id);
        try {
            $admin = (new UserModel($this->db))->verify_admin_by_token($input);
            if (!$admin['success']) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Admin token required.',
                    'change' => null,
                ];
            }

            if ($id <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'id is required.',
                    'change' => null,
                ];
            }

            $existing = $this->get_by_id($id);
            if ($existing === null) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Recent change not found.',
                    'change' => null,
                ];
            }

            $hasDate = array_key_exists('date', $input);
            $hasText = array_key_exists('changes_made', $input);
            if (!$hasDate && !$hasText) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'date or changes_made is required.',
                    'change' => null,
                ];
            }

            $parsed = $this->parse_fields([
                'date' => $hasDate ? $input['date'] : $existing['date'],
                'changes_made' => $hasText ? $input['changes_made'] : $existing['changes_made'],
            ]);
            if ($parsed['error'] !== '') {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => $parsed['error'],
                    'change' => null,
                ];
            }

            $this->db->update(
                'recent_changes',
                [
                    'date' => $parsed['date'],
                    'changes_made' => $parsed['changes_made'],
                ],
                ['id' => $id]
            );

            $ok = true;
            return [
                'success' => true,
                'message' => 'Recent change updated.',
                'error' => '',
                'change' => [
                    'id' => $id,
                    'date' => $parsed['date'],
                    'changes_made' => $parsed['changes_made'],
                ],
            ];
        } finally {
            (new LogModel())->record_result(
                'update recent change - admin',
                $ok,
                $actor,
                $logDetail
            );
        }
    }

    /**
     * Admin: delete a recent-change row.
     * Body: token, id.
     *
     * @return array{success:bool,message:string,error:string}
     */
    public function delete_recent_change(array $input): array
    {
        $actor = $this->actor_from_token((string)($input['token'] ?? ''));
        $ok = false;
        $id = (int)($input['id'] ?? 0);
        $logDetail = LogModel::id_detail($id);
        try {
            $admin = (new UserModel($this->db))->verify_admin_by_token($input);
            if (!$admin['success']) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Admin token required.',
                ];
            }

            if ($id <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'id is required.',
                ];
            }

            $deleted = $this->db->delete('recent_changes', ['id' => $id]);
            if ($deleted < 1) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Recent change not found.',
                ];
            }

            $ok = true;
            return [
                'success' => true,
                'message' => 'Recent change deleted.',
                'error' => '',
            ];
        } finally {
            (new LogModel())->record_result(
                'delete recent change - admin',
                $ok,
                $actor,
                $logDetail
            );
        }
    }

    private function get_by_id(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }
        $rows = $this->db->queryAll(
            'SELECT id, `date`, changes_made
             FROM recent_changes
             WHERE id = :id
             LIMIT 1',
            [':id' => $id]
        );
        if (empty($rows)) {
            return null;
        }
        return $this->map_row($rows[0]);
    }

    /**
     * @return array{date:string,changes_made:string,error:string}
     */
    private function parse_fields(array $input): array
    {
        $date = trim((string)($input['date'] ?? ''));
        $text = trim((string)($input['changes_made'] ?? ''));

        if ($date === '') {
            return ['date' => '', 'changes_made' => '', 'error' => 'date is required.'];
        }
        $parsed = DateTime::createFromFormat('Y-m-d', $date);
        $errors = DateTime::getLastErrors();
        $hasDateErrors = is_array($errors)
            && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0);
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $hasDateErrors) {
            return [
                'date' => '',
                'changes_made' => '',
                'error' => 'date must be YYYY-MM-DD.',
            ];
        }

        if ($text === '') {
            return ['date' => '', 'changes_made' => '', 'error' => 'changes_made is required.'];
        }
        if (strlen($text) > self::MAX_CHANGE_LENGTH) {
            return [
                'date' => '',
                'changes_made' => '',
                'error' => 'changes_made must be at most ' . self::MAX_CHANGE_LENGTH . ' characters.',
            ];
        }

        return [
            'date' => $date,
            'changes_made' => $text,
            'error' => '',
        ];
    }

    private function map_row(array $row): array
    {
        $rawDate = (string)($row['date'] ?? '');
        return [
            'id' => (int)($row['id'] ?? 0),
            'date' => substr($rawDate, 0, 10),
            'changes_made' => (string)($row['changes_made'] ?? ''),
        ];
    }

    private function actor_from_token(string $token): string
    {
        $token = trim($token);
        if ($token === '') {
            return '-';
        }
        $users = (new UserModel($this->db))->get_by_token($token);
        return !empty($users[0]['name']) ? (string)$users[0]['name'] : '-';
    }
}
