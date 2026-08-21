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
}