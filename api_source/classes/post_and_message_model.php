<?php
require_once __DIR__ . '/log_model.php';

class PostAndMessageModel
{
    private DatabaseAccess $db;

    public function __construct(DatabaseAccess $db)
    {
        $this->db = $db;
    }

    public function create_contact_message(array $input): array
    {
        $actor = trim((string)($input['name'] ?? ''));
        $ok = false;
        try {
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

        $ok = $id > 0;
        return [
            'success' => true,
            'message' => 'Contact message saved.',
            'error' => '',
            'id' => $id,
        ];
        } finally {
            (new LogModel())->record_result('create contact message', $ok, $actor !== '' ? $actor : '-');
        }
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
        $actor = '-';
        $ok = false;
        try {
        $userModel = new UserModel($this->db);
        $admin = $userModel->verify_admin_by_token($input);
        $users = $userModel->get_by_token((string)($input['token'] ?? ''));
        if (!empty($users[0]['name'])) {
            $actor = (string)$users[0]['name'];
        }
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

        $ok = true;
        return [
            'success' => true,
            'message' => 'Message deleted.',
            'error' => '',
        ];
        } finally {
            (new LogModel())->record_result('delete contact message - admin', $ok, $actor);
        }
    }

    /**
     * POST create_post — logged-in user inserts a row into posts.
     * Body: api_key, token, content (required); topic (optional).
     * Content allows <b>, <i>, <u>, <ol>, <ul>, <li> and http(s) links; other HTML is stripped.
     *
     * @return array{success:bool,message:string,error:string,post:?array}
     */
    public function create_post(array $input): array
    {
        $actor = '-';
        $ok = false;
        try {
            if (!$this->is_valid_api_key($input)) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Invalid or missing api_key.',
                    'post' => null,
                ];
            }

            $token = trim((string)($input['token'] ?? ''));
            if ($token === '') {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Token is required.',
                    'post' => null,
                ];
            }

            $userModel = new UserModel($this->db);
            $users = $userModel->get_by_token($token);
            if (empty($users)) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'User is not logged in or token expired.',
                    'post' => null,
                ];
            }

            $author = $users[0];
            $authorId = (int)($author['user_id'] ?? 0);
            if (!empty($author['name'])) {
                $actor = (string)$author['name'];
            }

            if ($authorId <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Could not resolve author user id.',
                    'post' => null,
                ];
            }

            $topic = trim(strip_tags((string)($input['topic'] ?? $input['title'] ?? '')));
            if (mb_strlen($topic) > 255) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Topic must be at most 255 characters.',
                    'post' => null,
                ];
            }

            $rawContent = (string)($input['content'] ?? '');
            $content = $this->sanitize_post_content($rawContent);
            if ($content === '') {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'content is required.',
                    'post' => null,
                ];
            }

            if (mb_strlen($content) > 65535) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Content is too long.',
                    'post' => null,
                ];
            }

            $postId = (int)$this->db->insert('posts', [
                'author_id' => $authorId,
                'topic' => $topic !== '' ? $topic : null,
                'content' => $content,
            ]);

            if ($postId <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Failed to create post.',
                    'post' => null,
                ];
            }

            $ok = true;
            return [
                'success' => true,
                'message' => 'Post created.',
                'error' => '',
                'post' => [
                    'post_id' => $postId,
                    'author_id' => $authorId,
                    'author' => $actor !== '-' ? $actor : null,
                    'topic' => $topic !== '' ? $topic : null,
                    'content' => $content,
                ],
            ];
        } finally {
            (new LogModel())->record_result('create post', $ok, $actor);
        }
    }

    /**
     * POST delete_post — author deletes their own post.
     * Body: api_key, token, id|post_id.
     *
     * @return array{success:bool,message:string,error:string}
     */
    public function delete_post(array $input): array
    {
        $actor = '-';
        $ok = false;
        try {
            if (!$this->is_valid_api_key($input)) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Invalid or missing api_key.',
                ];
            }

            $token = trim((string)($input['token'] ?? ''));
            if ($token === '') {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Token is required.',
                ];
            }

            $userModel = new UserModel($this->db);
            $users = $userModel->get_by_token($token);
            if (empty($users)) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'User is not logged in or token expired.',
                ];
            }

            $author = $users[0];
            $authorId = (int)($author['user_id'] ?? 0);
            if (!empty($author['name'])) {
                $actor = (string)$author['name'];
            }

            if ($authorId <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Could not resolve author user id.',
                ];
            }

            $postId = (int)($input['post_id'] ?? $input['id'] ?? 0);
            if ($postId <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'id is required.',
                ];
            }

            $rows = $this->db->select('posts', ['post_id' => $postId]);
            if (empty($rows)) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Post not found.',
                ];
            }

            $postAuthorId = (int)($rows[0]['author_id'] ?? 0);
            if ($postAuthorId !== $authorId) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Only the author can delete this post.',
                ];
            }

            $this->db->delete('media_in_post', ['post_id' => $postId]);
            $deleted = $this->db->delete('posts', [
                'post_id' => $postId,
                'author_id' => $authorId,
            ]);
            if ($deleted < 1) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Failed to delete post.',
                ];
            }

            $ok = true;
            return [
                'success' => true,
                'message' => 'Post deleted.',
                'error' => '',
            ];
        } finally {
            (new LogModel())->record_result('delete post', $ok, $actor);
        }
    }

    private function is_valid_api_key(array $input): bool
    {
        $apiKeys = json_decode((string)getenv('API_KEYS'), true);
        $providedKey = isset($input['api_key']) ? (string)$input['api_key'] : '';

        return is_array($apiKeys) && in_array($providedKey, $apiKeys, true);
    }

    /**
     * Allow <b>, <i>, <u>, <ol>, <ul>, <li> and <a href="https://..."> only.
     * Strip scripts, event handlers, and non-http(s) URLs to keep stored HTML XSS-safe.
     */
    private function sanitize_post_content(string $content): string
    {
        $content = str_replace("\0", '', $content);
        $content = trim($content);
        if ($content === '') {
            return '';
        }

        $content = strip_tags($content, '<b><i><u><ol><ul><li><a>');
        $content = preg_replace('/<(b|i|u|ol|ul|li)(\s[^>]*)?>/i', '<$1>', $content) ?? $content;
        $content = preg_replace('/<\/(b|i|u|ol|ul|li)(\s[^>]*)?>/i', '</$1>', $content) ?? $content;

        $content = preg_replace_callback(
            '/<a\s+([^>]*)>/i',
            function (array $matches): string {
                $attrs = $matches[1];
                $href = '';
                if (preg_match('/href\s*=\s*(["\'])(.*?)\1/i', $attrs, $hrefMatch)) {
                    $href = $hrefMatch[2];
                } elseif (preg_match('/href\s*=\s*([^\s>]+)/i', $attrs, $hrefMatch)) {
                    $href = $hrefMatch[1];
                }

                $href = html_entity_decode($href, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                $safeHref = $this->sanitize_href($href);
                if ($safeHref === null) {
                    return '<a>';
                }

                return '<a href="' . htmlspecialchars($safeHref, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '" rel="noopener noreferrer" target="_blank">';
            },
            $content
        ) ?? $content;

        return trim($content);
    }

    private function sanitize_href(string $url): ?string
    {
        $url = trim($url);
        if ($url === '' || preg_match('/[\x00-\x1F\x7F]/', $url)) {
            return null;
        }

        if (preg_match('#^(javascript|data|vbscript|file):#i', $url)) {
            return null;
        }

        if (!preg_match('#^https?://#i', $url)) {
            return null;
        }

        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        return $url;
    }
}
