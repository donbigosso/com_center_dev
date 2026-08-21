<?php
class PostAndMessageModel
{
    private DatabaseAccess $db;

    public function __construct(DatabaseAccess $db)
    {
        $this->db = $db;
    }

    public function create_contact_message(array $input): array
    {
        $apiKeys = json_decode((string)getenv('API_KEYS'), true);
        $providedKey = isset($input['api_key']) ? (string)$input['api_key'] : '';

        if (!is_array($apiKeys) || !in_array($providedKey, $apiKeys, true)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Invalid or missing api_key.',
                'id' => null,
            ];
        }

        $name = trim((string)($input['name'] ?? ''));
        $email = trim((string)($input['email'] ?? ''));
        $message = trim((string)($input['message'] ?? ''));

        if ($name === '' || $email === '' || $message === '') {
            return [
                'success' => false,
                'message' => '',
                'error' => 'name, email and message are required.',
                'id' => null,
            ];
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Invalid email.',
                'id' => null,
            ];
        }

        $senderIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        if (is_string($senderIp) && strpos($senderIp, ',') !== false) {
            $senderIp = trim(explode(',', $senderIp)[0]);
        }

        $id = $this->db->insert('contact_messages', [
            'name' => $name,
            'email' => $email,
            'message' => $message,
            'sender_ip' => $senderIp,
        ]);

        return [
            'success' => true,
            'message' => 'Contact message saved.',
            'error' => '',
            'id' => $id,
        ];
    }
    public function list_contact_messages(array $input): array
        {
            $admin = (new UserModel($this->db))->verify_admin_by_token($input);
            if (!$admin['success']) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Admin token required.',
                    'messages' => [],
                ];
            }

            $rows = $this->db->queryAll(
                'SELECT id, name, email, message, sender_ip, created_at
                FROM contact_messages
                ORDER BY created_at DESC'
            );

            return [
                'success' => true,
                'message' => 'Messages retrieved.',
                'error' => '',
                'messages' => $rows,
            ];
        }

    public function delete_contact_message(array $input): array
    {
        $admin = (new UserModel($this->db))->verify_admin_by_token($input);
        if (!$admin['success']) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Admin token required.',
            ];
        }

        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'id is required.',
            ];
        }

        $deleted = $this->db->delete('contact_messages', ['id' => $id]);
        if ($deleted < 1) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Message not found.',
            ];
        }

        return [
            'success' => true,
            'message' => 'Message deleted.',
            'error' => '',
        ];
    }
}
