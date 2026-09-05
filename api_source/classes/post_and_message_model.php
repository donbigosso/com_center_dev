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

            $page = strtoupper(trim((string)($input['page'] ?? '')));
            if ($page !== '' && !$this->is_valid_post_page($page)) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Invalid page. Allowed: ' . implode(', ', $this->get_post_page_enums()) . '.',
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

            if ($page !== '') {
                $this->db->insert('posts_in_pages', [
                    'post_id' => $postId,
                    'page' => $page,
                ]);
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
                    'pages' => $page !== '' ? [$page] : [],
                    'media' => [],
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
            $this->db->delete('posts_in_pages', ['post_id' => $postId]);
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


    /**
     * GET get_post — public read of one posts row.
     * Query: id|post_id.
     *
     * @return array{success:bool,message:string,error:string,post:?array}
     */
    public function get_post(array $input): array
    {
        $postId = (int)($input['post_id'] ?? $input['id'] ?? 0);
        if ($postId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'id is required.',
                'post' => null,
            ];
        }

        $rows = $this->db->queryAll(
            'SELECT
                p.post_id,
                p.author_id,
                u.name AS author,
                p.topic,
                p.content,
                p.date_added
             FROM posts p
             LEFT JOIN users u ON u.user_id = p.author_id
             WHERE p.post_id = :id
             LIMIT 1',
            [':id' => $postId]
        );

        if (empty($rows)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Post not found.',
                'post' => null,
            ];
        }

        $post = $this->map_post_row($rows[0]);
        $post['media'] = $this->get_media_for_post_ids([$post['post_id']])[$post['post_id']] ?? [];

        return [
            'success' => true,
            'message' => 'Post retrieved.',
            'error' => '',
            'post' => $post,
        ];
    }

    /**
     * GET list_posts — paginated public list.
     * Query: page (default 1), limit (default 20, max 100),
     *        user (optional author name),
     *        on_page (optional posts_in_pages.page ENUM: TRIP, BLOG, ABOUT).
     *
     * @return array{success:bool,message:string,error:string,posts:array,page:int,limit:int,total:int,has_more:bool,author_filter:?string}
     */
    public function list_posts(array $input): array
    {
        $page = max(1, (int)($input['page'] ?? 1));
        $limit = max(1, min(100, (int)($input['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $author = trim((string)($input['user'] ?? $input['author'] ?? ''));
        if ($author === '') {
            $author = null;
        }

        $params = [];
        $authorSql = '';
        if ($author !== null) {
            $authorSql = ' AND u.name = :author_name ';
            $params[':author_name'] = $author;
        }

        $onPage = strtoupper(trim((string)($input['on_page'] ?? $input['page_enum'] ?? '')));
        if ($onPage === '') {
            $onPage = null;
        } elseif (!$this->is_valid_post_page($onPage)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Invalid on_page. Allowed: ' . implode(', ', $this->get_post_page_enums()) . '.',
                'posts' => [],
                'page' => $page,
                'limit' => $limit,
                'total' => 0,
                'has_more' => false,
                'author_filter' => $author,
                'on_page' => $onPage,
            ];
        }

        $pageJoinSql = '';
        $pageSql = '';
        if ($onPage !== null) {
            $pageJoinSql = ' INNER JOIN posts_in_pages pip ON pip.post_id = p.post_id ';
            $pageSql = ' AND pip.page = :on_page ';
            $params[':on_page'] = $onPage;
        }

        $total = (int)($this->db->queryValue(
            "SELECT COUNT(*)
             FROM posts p
             LEFT JOIN users u ON u.user_id = p.author_id
             {$pageJoinSql}
             WHERE 1=1 {$authorSql} {$pageSql}",
            $params
        ) ?? 0);

        $rows = $this->db->queryAll(
            "SELECT
                p.post_id,
                p.author_id,
                u.name AS author,
                p.topic,
                p.content,
                p.date_added
             FROM posts p
             LEFT JOIN users u ON u.user_id = p.author_id
             {$pageJoinSql}
             WHERE 1=1 {$authorSql} {$pageSql}
             ORDER BY p.date_added DESC, p.post_id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params
        );

        $posts = array_map(fn(array $row): array => $this->map_post_row($row), $rows);

        $mediaByPost = $this->get_media_for_post_ids(array_column($posts, 'post_id'));
        foreach ($posts as &$post) {
            $post['media'] = $mediaByPost[$post['post_id']] ?? [];
        }
        unset($post);

        $returned = count($posts);

        return [
            'success' => true,
            'message' => 'Posts retrieved.',
            'error' => '',
            'posts' => $posts,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'has_more' => ($offset + $returned) < $total,
            'author_filter' => $author,
            'on_page' => $onPage,
        ];
    }

    /**
     * GET list_post_pages — allowed posts_in_pages.page ENUM values.
     *
     * @return array<int, string>
     */
    public function list_post_pages(): array
    {
        return $this->get_post_page_enums();
    }

    private function map_post_row(array $row): array
    {
        return [
            'post_id' => (int)$row['post_id'],
            'author_id' => isset($row['author_id']) ? (int)$row['author_id'] : null,
            'author' => $row['author'] ?? null,
            'topic' => $row['topic'] !== null && $row['topic'] !== '' ? $row['topic'] : null,
            'content' => $row['content'] ?? '',
            'date_added' => $row['date_added'] ?? null,
            // 'media' is filled in separately by get_media_for_post_ids()
            // once the caller knows every post_id it needs (see get_post /
            // list_posts) so we only ever run one extra query, not one per post.
            'media' => [],
        ];
    }

    /**
     * Bulk-fetch media attached to posts via media_in_post, keyed by post_id.
     * Same filename/miniature_filename convention as
     * GalleryModel::list_gallery_media() ({base}_sm.{ext}) so the frontend
     * can resolve thumbnail/full-size URLs against the same gallery_folder
     * setting regardless of whether the media came from a gallery or a post.
     *
     * @param array<int> $postIds
     * @return array<int, array<int, array{
     *   media_item_id:int, title:?string, media_type:string,
     *   filename:?string, miniature_filename:?string
     * }>>
     */
    private function get_media_for_post_ids(array $postIds): array
    {
        $postIds = array_values(array_unique(array_map('intval', $postIds)));
        $postIds = array_filter($postIds, fn(int $id): bool => $id > 0);
        if (empty($postIds)) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($postIds as $i => $id) {
            $key = ":post_id_{$i}";
            $placeholders[] = $key;
            $params[$key] = $id;
        }

        $rows = $this->db->queryAll(
            'SELECT
                mip.post_id,
                mi.media_item_id,
                mi.title,
                mi.media_type,
                f.filename
             FROM media_in_post mip
             JOIN media_items mi ON mi.media_item_id = mip.media_item_id
             JOIN files f ON f.file_id = mi.file_id
             WHERE mip.post_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY mi.media_item_id ASC',
            $params
        );

        $byPost = [];
        foreach ($rows as $row) {
            $postId = (int)$row['post_id'];
            $filename = (string)($row['filename'] ?? '');
            $base = pathinfo($filename, PATHINFO_FILENAME);
            $ext = pathinfo($filename, PATHINFO_EXTENSION);
            $miniature = $filename !== ''
                ? ($ext !== '' ? "{$base}_sm.{$ext}" : "{$base}_sm")
                : null;

            $byPost[$postId][] = [
                'media_item_id' => (int)$row['media_item_id'],
                'title' => $row['title'] !== null && $row['title'] !== '' ? $row['title'] : null,
                'media_type' => (string)$row['media_type'],
                'filename' => $filename !== '' ? $filename : null,
                'miniature_filename' => $miniature,
            ];
        }

        return $byPost;
    }

    /**
     * @return array<int, string>
     */
    private function get_post_page_enums(): array
    {
        return ['TRIP', 'BLOG', 'ABOUT'];
    }

    private function is_valid_post_page(string $page): bool
    {
        return in_array(strtoupper($page), $this->get_post_page_enums(), true);
    }

    private function is_valid_api_key(array $input): bool
    {
        $apiKeys = json_decode((string)getenv('API_KEYS'), true);
        $providedKey = isset($input['api_key']) ? (string)$input['api_key'] : '';

        return is_array($apiKeys) && in_array($providedKey, $apiKeys, true);
    }

    /**
     * Post content is stored as a small custom markup, NOT raw HTML.
     * This keeps storage inert (nothing here can ever be interpreted as a
     * tag by a browser) and lets the frontend render it purely with
     * document.createElement / appendChild (see
     * frontend/functions/PostContentFunctions.js) — never innerHTML — so
     * stored content cannot cause XSS even if this sanitizer had a bug.
     *
     * Supported formatting a user can type in a post:
     *   [b]bold text[/b]
     *   [i]italic text[/i]
     *   [u]underlined text[/u]
     *   [ol][li]first[/li][li]second[/li][/ol]   -> ordered list
     *   [ul][li]first[/li][li]second[/li][/ul]   -> unordered list
     *   [url=https://example.com]link text[/url] -> link (http/https only)
     *
     * Anything else — real HTML tags, unknown [tags], unmatched brackets —
     * is left as plain, literal text: strip_tags() removes actual HTML
     * first, then only the whitelisted [tag] patterns below are recognized;
     * everything else round-trips as-is and is displayed verbatim by the
     * frontend parser instead of being interpreted.
     */
    private function sanitize_post_content(string $content): string
    {
        $content = str_replace("\0", '', $content);
        $content = trim($content);
        if ($content === '') {
            return '';
        }

        // Remove any literal HTML the user pasted in — only our own
        // [tag] markup below is ever treated as formatting.
        $content = strip_tags($content);

        $allowedTags = ['b', 'i', 'u', 'ol', 'ul', 'li'];

        // Normalize/validate every [tag] occurrence. [url=...] additionally
        // requires a safe http(s) href or it is dropped (its label text is
        // kept, the tag itself is not).
        $content = preg_replace_callback(
            '/\[(\/?)([a-zA-Z]+)(=[^\]]*)?\]/',
            function (array $matches) use ($allowedTags): string {
                $closing = $matches[1] === '/';
                $tag = strtolower($matches[2]);
                $rawAttr = isset($matches[3]) ? ltrim($matches[3], '=') : '';

                if ($tag === 'url') {
                    if ($closing) {
                        return '[/url]';
                    }
                    $href = html_entity_decode(trim($rawAttr, " \t\"'"), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $safeHref = $this->sanitize_href($href);
                    // Invalid/unsafe href: drop the tag, keep surrounding text intact.
                    return $safeHref !== null ? '[url=' . $safeHref . ']' : '';
                }

                if (in_array($tag, $allowedTags, true)) {
                    return $closing ? "[/{$tag}]" : "[{$tag}]";
                }

                // Not one of our known tags: leave the brackets as plain
                // text rather than as active markup.
                return htmlspecialchars($matches[0], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            },
            $content
        ) ?? $content;

        return trim($this->balance_markup_tags($content, $allowedTags));
    }

    /**
     * Drops closing [tag]s that never had a matching opener and auto-closes
     * any tag still open at the end of the content, so malformed nesting
     * from the client (or a hand-crafted request) can't produce markup the
     * frontend parser would render unbalanced.
     */
    private function balance_markup_tags(string $content, array $allowedTags): string
    {
        $trackedTags = array_merge($allowedTags, ['url']);
        $pattern = '/\[(\/?)(' . implode('|', $trackedTags) . ')(=[^\]]*)?\]/i';

        $stack = [];
        $result = preg_replace_callback($pattern, function (array $m) use (&$stack): string {
            $closing = $m[1] === '/';
            $tag = strtolower($m[2]);

            if (!$closing) {
                $stack[] = $tag;
                return $m[0];
            }

            // Only keep a closing tag if it matches the most recently opened one.
            if (!empty($stack) && end($stack) === $tag) {
                array_pop($stack);
                return $m[0];
            }

            return ''; // stray closing tag, drop it
        }, $content) ?? $content;

        // Auto-close anything left open, innermost first.
        while (!empty($stack)) {
            $result .= '[/' . array_pop($stack) . ']';
        }

        return $result;
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
