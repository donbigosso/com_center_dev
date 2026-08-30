<?php
require_once __DIR__ . '/log_model.php';

class GalleryModel
{
    private DatabaseAccess $db;

    public function __construct(DatabaseAccess $db)
    {
        $this->db = $db;
    }

    /**
     * List media_collections with optional owner filter.
     * Page is 1-based. Returns rows shaped for the frontend gallery cards.
     *
     * @param string|null $ownerUsername When set, only collections owned by this user.
     */
    public function list_galleries(int $page = 1, int $limit = 12, ?string $ownerUsername = null): array
    {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $offset = ($page - 1) * $limit;

        $ownerUsername = $ownerUsername !== null ? trim($ownerUsername) : null;
        if ($ownerUsername === '') {
            $ownerUsername = null;
        }

        $params = [];
        $ownerFilterSql = '';
        if ($ownerUsername !== null) {
            // Collections where this username is listed in collection_owners
            $ownerFilterSql = '
                AND EXISTS (
                    SELECT 1
                    FROM collection_owners cof
                    INNER JOIN users uf ON uf.user_id = cof.user_id
                    WHERE cof.media_collection_id = mc.media_collection_id
                      AND uf.name = :owner_name
                )
            ';
            $params[':owner_name'] = $ownerUsername;
        }

        $total = (int)($this->db->queryValue(
            "SELECT COUNT(*) FROM media_collections mc WHERE 1=1 {$ownerFilterSql}",
            $params
        ) ?? 0);

        // LIMIT/OFFSET interpolated only after strict int clamping (PDO + native prepares is picky)
        $sql = "
            SELECT
                mc.media_collection_id AS id,
                mc.title,
                mc.description,
                mc.register_date,
                mc.collection_cover_id,
                (
                    SELECT u.name
                    FROM collection_owners co
                    INNER JOIN users u ON u.user_id = co.user_id
                    WHERE co.media_collection_id = mc.media_collection_id
                    ORDER BY co.access_granted ASC
                    LIMIT 1
                ) AS owner,
                (
                    SELECT COUNT(*)
                    FROM media_in_collection mic
                    WHERE mic.media_collection_id = mc.media_collection_id
                ) AS image_count
            FROM media_collections mc
            WHERE 1=1
            {$ownerFilterSql}
            ORDER BY mc.register_date DESC, mc.media_collection_id DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $rows = $this->db->queryAll($sql, $params);

        $galleries = array_map(static function (array $row): array {
            return [
                'id' => (int)$row['id'],
                'title' => $row['title'] ?? '',
                'description' => $row['description'] ?? '',
                'register_date' => $row['register_date'] ?? null,
                'collection_cover_id' => isset($row['collection_cover_id'])
                    ? (int)$row['collection_cover_id']
                    : null,
                'owner' => $row['owner'] ?: null,
                'image_count' => (int)($row['image_count'] ?? 0),
            ];
        }, $rows);

        $returned = count($galleries);
        $hasMore = ($offset + $returned) < $total;

        return [
            'galleries' => $galleries,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'has_more' => $hasMore,
            'owner_filter' => $ownerUsername,
        ];
    }

    /**
     * Create a media_collections row and assign the creator as owner
     * in collection_owners.
     *
     * @return array{success:bool,message:string,error:string,gallery:?array}
     */
    public function create_gallery(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $title = trim((string)($input['title'] ?? ''));
        $description = trim((string)($input['description'] ?? ''));
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {
        if ($token === '') {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Token is required.',
                'gallery' => null,
            ];
        }

        $userModel = new UserModel($this->db);
        $users = $userModel->get_by_token($token);
        if (empty($users)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'User is not logged in or token expired.',
                'gallery' => null,
            ];
        }

        $creator = $users[0];
        $userId = (int)($creator['user_id'] ?? 0);
        $ownerName = $creator['name'] ?? null;
        if (!empty($ownerName)) {
            $actor = (string)$ownerName;
        }

        if ($userId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Could not resolve creator user id.',
                'gallery' => null,
            ];
        }

        if (mb_strlen($title) < 3) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Title must be at least 3 characters.',
                'gallery' => null,
            ];
        }

        if (mb_strlen($title) > 200) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Title must be at most 200 characters.',
                'gallery' => null,
            ];
        }

        if (mb_strlen($description) > 255) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Description must be at most 255 characters.',
                'gallery' => null,
            ];
        }

        try {
            $collectionId = (int)$this->db->insert('media_collections', [
                'title' => $title,
                'description' => $description !== '' ? $description : null,
            ]);

            if ($collectionId <= 0) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Failed to create gallery.',
                    'gallery' => null,
                ];
            }

            $this->db->insert('collection_owners', [
                'user_id' => $userId,
                'media_collection_id' => $collectionId,
            ]);

            $gallery = $this->get_gallery_by_id($collectionId);
            if ($gallery === null) {
                // Fallback if re-read fails
                $gallery = [
                    'id' => $collectionId,
                    'title' => $title,
                    'description' => $description,
                    'register_date' => date('Y-m-d H:i:s'),
                    'collection_cover_id' => null,
                    'owner' => $ownerName,
                    'image_count' => 0,
                ];
            }

            $ok = true;
            return [
                'success' => true,
                'message' => 'Gallery created successfully.',
                'error' => '',
                'gallery' => $gallery,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to create gallery.',
                'gallery' => null,
            ];
        }
        } finally {
            (new LogModel())->record_result('create gallery', $ok, $actor);
        }
    }

    /**
     * Whether the given user owns the gallery (is listed in collection_owners).
     */
    public function user_owns_gallery(int $userId, int $galleryId): bool
    {
        if ($userId <= 0 || $galleryId <= 0) {
            return false;
        }

        $found = $this->db->queryValue(
            'SELECT 1
             FROM collection_owners
             WHERE user_id = :user_id
               AND media_collection_id = :gallery_id
             LIMIT 1',
            [
                ':user_id' => $userId,
                ':gallery_id' => $galleryId,
            ]
        );

        return $found !== null;
    }

    /**
     * Update gallery title, description, and/or register_date.
     * Only owners (collection_owners) may update.
     *
     * Body: token, id, optional title, description, register_date.
     *
     * @return array{success:bool,message:string,error:string,gallery:?array}
     */
    public function update_gallery(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['id']) ? (int)$input['id'] : 0;
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {
        if ($token === '') {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Token is required.',
                'gallery' => null,
            ];
        }

        if ($galleryId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id is required.',
                'gallery' => null,
            ];
        }

        $userModel = new UserModel($this->db);
        $users = $userModel->get_by_token($token);
        if (empty($users)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'User is not logged in or token expired.',
                'gallery' => null,
            ];
        }

        $userId = (int)($users[0]['user_id'] ?? 0);
        if ($userId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Could not resolve user.',
                'gallery' => null,
            ];
        }

        $existing = $this->get_gallery_by_id($galleryId);
        if ($existing === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery not found.',
                'gallery' => null,
            ];
        }

        if (!$this->user_owns_gallery($userId, $galleryId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'You do not have permission to edit this gallery.',
                'gallery' => null,
            ];
        }

        $updates = [];

        $hasTitle = array_key_exists('title', $input);
        $hasDescription = array_key_exists('description', $input);
        $hasDate = array_key_exists('register_date', $input)
            || array_key_exists('added_date', $input);

        if ($hasTitle) {
            $title = trim((string)$input['title']);
            if (mb_strlen($title) < 3) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Title must be at least 3 characters.',
                    'gallery' => null,
                ];
            }
            if (mb_strlen($title) > 200) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Title must be at most 200 characters.',
                    'gallery' => null,
                ];
            }
            $updates['title'] = $title;
        }

        if ($hasDescription) {
            $description = trim((string)$input['description']);
            if (mb_strlen($description) > 255) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Description must be at most 255 characters.',
                    'gallery' => null,
                ];
            }
            $updates['description'] = $description !== '' ? $description : null;
        }

        if ($hasDate) {
            $rawDate = $input['register_date'] ?? $input['added_date'] ?? '';
            $rawDate = trim((string)$rawDate);
            if ($rawDate === '') {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Added date is required.',
                    'gallery' => null,
                ];
            }

            $normalized = $this->normalize_gallery_datetime($rawDate);
            if ($normalized === null) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Invalid added date. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS.',
                    'gallery' => null,
                ];
            }
            $updates['register_date'] = $normalized;
        }

        if (empty($updates)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'No fields to update.',
                'gallery' => null,
            ];
        }

        try {
            $this->db->update('media_collections', $updates, [
                'media_collection_id' => $galleryId,
            ]);

            $gallery = $this->get_gallery_by_id($galleryId);
            $ok = true;
            return [
                'success' => true,
                'message' => 'Gallery updated successfully.',
                'error' => '',
                'gallery' => $gallery,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to update gallery.',
                'gallery' => null,
            ];
        }
        } finally {
            (new LogModel())->record_result('update gallery', $ok, $actor);
        }
    }

    /**
     * Accept date or datetime strings and return MySQL datetime, or null if invalid.
     */
    private function normalize_gallery_datetime(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        // HTML datetime-local: 2026-07-24T09:15
        $value = str_replace('T', ' ', $value);

        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d H:i',
            'Y-m-d',
        ];

        foreach ($formats as $format) {
            $dt = DateTime::createFromFormat($format, $value);
            if ($dt instanceof DateTime) {
                $errors = DateTime::getLastErrors();
                if (is_array($errors) && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0)) {
                    continue;
                }
                // Date-only → midnight
                if ($format === 'Y-m-d') {
                    return $dt->format('Y-m-d') . ' 00:00:00';
                }
                return $dt->format('Y-m-d H:i:s');
            }
        }

        return null;
    }

    /**
     * Fetch a single gallery in the same shape as list_galleries rows.
     */
    public function get_gallery_by_id(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $sql = '
            SELECT
                mc.media_collection_id AS id,
                mc.title,
                mc.description,
                mc.register_date,
                mc.collection_cover_id,
                (
                    SELECT u.name
                    FROM collection_owners co
                    INNER JOIN users u ON u.user_id = co.user_id
                    WHERE co.media_collection_id = mc.media_collection_id
                    ORDER BY co.access_granted ASC
                    LIMIT 1
                ) AS owner,
                (
                    SELECT COUNT(*)
                    FROM media_in_collection mic
                    WHERE mic.media_collection_id = mc.media_collection_id
                ) AS image_count
            FROM media_collections mc
            WHERE mc.media_collection_id = :id
            LIMIT 1
        ';

        $rows = $this->db->queryAll($sql, [':id' => $id]);
        if (empty($rows)) {
            return null;
        }

        $row = $rows[0];
        return [
            'id' => (int)$row['id'],
            'title' => $row['title'] ?? '',
            'description' => $row['description'] ?? '',
            'register_date' => $row['register_date'] ?? null,
            'collection_cover_id' => isset($row['collection_cover_id'])
                ? (int)$row['collection_cover_id']
                : null,
            'owner' => $row['owner'] ?: null,
            'image_count' => (int)($row['image_count'] ?? 0),
        ];
    }

    /**
     * List media items in a gallery (paginated).
     * Page is 1-based. Ordered by date_added ASC, then media_item_id ASC.
     *
     * @return array{
     *   success:bool,
     *   message:string,
     *   error:string,
     *   media:array<int,array>,
     *   page:int,
     *   limit:int,
     *   total:int,
     *   has_more:bool,
     *   gallery_id:int
     * }
     */
    public function list_gallery_media(int $galleryId, int $page = 1, int $limit = 20): array
    {
        $galleryId = (int)$galleryId;
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $offset = ($page - 1) * $limit;

        if ($galleryId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id is required.',
                'media' => [],
                'page' => $page,
                'limit' => $limit,
                'total' => 0,
                'has_more' => false,
                'gallery_id' => $galleryId,
            ];
        }

        $exists = $this->db->queryValue(
            'SELECT media_collection_id
             FROM media_collections
             WHERE media_collection_id = :id
             LIMIT 1',
            [':id' => $galleryId]
        );

        if ($exists === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery not found.',
                'media' => [],
                'page' => $page,
                'limit' => $limit,
                'total' => 0,
                'has_more' => false,
                'gallery_id' => $galleryId,
            ];
        }

        $total = (int)($this->db->queryValue(
            'SELECT COUNT(*)
             FROM media_in_collection
             WHERE media_collection_id = :id',
            [':id' => $galleryId]
        ) ?? 0);

        $sql = "
            SELECT
                mi.media_item_id AS id,
                mi.media_type,
                mi.title,
                mi.descr AS description,
                mi.tags,
                f.filename,
                mic.date_added
            FROM media_in_collection mic
            INNER JOIN media_items mi ON mi.media_item_id = mic.media_item_id
            INNER JOIN files f ON f.file_id = mi.file_id
            WHERE mic.media_collection_id = :id
            ORDER BY mic.date_added ASC, mi.media_item_id ASC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $rows = $this->db->queryAll($sql, [':id' => $galleryId]);

        $media = array_map(static function (array $row): array {
            $filename = (string)($row['filename'] ?? '');
            $base = pathinfo($filename, PATHINFO_FILENAME);
            $ext = pathinfo($filename, PATHINFO_EXTENSION);
            $miniature = $filename !== ''
                ? ($ext !== '' ? "{$base}_sm.{$ext}" : "{$base}_sm")
                : null;

            return [
                'id' => (int)$row['id'],
                'media_type' => $row['media_type'] ?? null,
                'title' => $row['title'] ?? '',
                'description' => $row['description'] ?? '',
                'tags' => $row['tags'] ?? null,
                'filename' => $filename !== '' ? $filename : null,
                'miniature_filename' => $miniature,
                'date_added' => $row['date_added'] ?? null,
            ];
        }, $rows);

        $returned = count($media);
        $hasMore = ($offset + $returned) < $total;

        return [
            'success' => true,
            'message' => 'Gallery media retrieved successfully.',
            'error' => '',
            'media' => $media,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'has_more' => $hasMore,
            'gallery_id' => $galleryId,
        ];
    }

    /**
     * Return the media item id used as the gallery cover (collection_cover_id),
     * or null if the gallery does not exist or has no cover set.
     */
    public function get_gallery_cover_id(int $galleryId): ?int
    {
        if ($galleryId <= 0) {
            return null;
        }

        $value = $this->db->queryValue(
            'SELECT collection_cover_id
             FROM media_collections
             WHERE media_collection_id = :id
             LIMIT 1',
            [':id' => $galleryId]
        );

        if ($value === null) {
            return null;
        }

        return (int)$value;
    }

    /**
     * Return the cover image filename for a gallery (via collection_cover_id → media_items → files).
     *
     * @return array{success:bool,message:string,error:string,filename:?string}
     */
    public function get_gallery_cover_filename(int $galleryId): array
    {
        $coverId = $this->get_gallery_cover_id($galleryId);
        if ($coverId === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery cover is not set or gallery does not exist.',
                'filename' => null,
            ];
        }

        $filename = $this->db->queryValue(
            'SELECT f.filename
             FROM media_items mi
             INNER JOIN files f ON f.file_id = mi.file_id
             WHERE mi.media_item_id = :cover_id
             LIMIT 1',
            [':cover_id' => $coverId]
        );

        if ($filename === null || trim((string)$filename) === '') {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Cover file not found.',
                'filename' => null,
            ];
        }

        return [
            'success' => true,
            'message' => 'Cover filename retrieved successfully.',
            'error' => '',
            'filename' => (string)$filename,
        ];
    }

    /**
     * Return the miniature filename for a gallery cover.
     * Derived from the regular filename by inserting "_sm" before the extension
     * (e.g. Image_00001.jpeg → Image_00001_sm.jpeg).
     *
     * @return array{success:bool,message:string,error:string,filename:?string}
     */
    public function get_gallery_cover_miniature_filename(int $galleryId): array
    {
        $result = $this->get_gallery_cover_filename($galleryId);
        if (!$result['success'] || empty($result['filename'])) {
            return [
                'success' => false,
                'message' => '',
                'error' => $result['error'] !== ''
                    ? $result['error']
                    : 'Could not resolve cover filename for miniature.',
                'filename' => null,
            ];
        }

        $filename = (string)$result['filename'];
        $base = pathinfo($filename, PATHINFO_FILENAME);
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $miniature = $ext !== ''
            ? "{$base}_sm.{$ext}"
            : "{$base}_sm";

        return [
            'success' => true,
            'message' => 'Cover miniature filename retrieved successfully.',
            'error' => '',
            'filename' => $miniature,
        ];
    }

    /**
     * Resolve logged-in user id from token, or null if invalid.
     */
    private function resolve_user_id_from_token(string $token): ?int
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        $userModel = new UserModel($this->db);
        $users = $userModel->get_by_token($token);
        if (empty($users)) {
            return null;
        }

        $userId = (int)($users[0]['user_id'] ?? 0);
        return $userId > 0 ? $userId : null;
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

    /**
     * Whether a media item belongs to a gallery.
     */
    public function media_in_gallery(int $galleryId, int $mediaId): bool
    {
        if ($galleryId <= 0 || $mediaId <= 0) {
            return false;
        }

        $found = $this->db->queryValue(
            'SELECT 1
             FROM media_in_collection
             WHERE media_collection_id = :gallery_id
               AND media_item_id = :media_id
             LIMIT 1',
            [
                ':gallery_id' => $galleryId,
                ':media_id' => $mediaId,
            ]
        );

        return $found !== null;
    }

    /**
     * Map a media row to the public API shape (same as list_gallery_media items).
     */
    private function map_media_row(array $row): array
    {
        $filename = (string)($row['filename'] ?? '');
        $base = pathinfo($filename, PATHINFO_FILENAME);
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $miniature = $filename !== ''
            ? ($ext !== '' ? "{$base}_sm.{$ext}" : "{$base}_sm")
            : null;

        return [
            'id' => (int)$row['id'],
            'media_type' => $row['media_type'] ?? null,
            'title' => $row['title'] ?? '',
            'description' => $row['description'] ?? '',
            'tags' => $row['tags'] ?? null,
            'filename' => $filename !== '' ? $filename : null,
            'miniature_filename' => $miniature,
            'date_added' => $row['date_added'] ?? null,
        ];
    }

    /**
     * Fetch one media item that belongs to a gallery.
     *
     * @return array{success:bool,message:string,error:string,media:?array}
     */
    public function get_gallery_media_item(int $galleryId, int $mediaId): array
    {
        if ($galleryId <= 0 || $mediaId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id and media id are required.',
                'media' => null,
            ];
        }

        $sql = '
            SELECT
                mi.media_item_id AS id,
                mi.media_type,
                mi.title,
                mi.descr AS description,
                mi.tags,
                f.filename,
                mic.date_added
            FROM media_in_collection mic
            INNER JOIN media_items mi ON mi.media_item_id = mic.media_item_id
            INNER JOIN files f ON f.file_id = mi.file_id
            WHERE mic.media_collection_id = :gallery_id
              AND mi.media_item_id = :media_id
            LIMIT 1
        ';

        $rows = $this->db->queryAll($sql, [
            ':gallery_id' => $galleryId,
            ':media_id' => $mediaId,
        ]);

        if (empty($rows)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Picture not found in this gallery.',
                'media' => null,
            ];
        }

        return [
            'success' => true,
            'message' => 'Media item retrieved successfully.',
            'error' => '',
            'media' => $this->map_media_row($rows[0]),
        ];
    }

    /**
     * Update media item title/description (owner of the gallery only).
     * Body: token, gallery_id, media_id, optional title, description.
     *
     * @return array{success:bool,message:string,error:string,media:?array}
     */
    public function update_gallery_media(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['gallery_id']) ? (int)$input['gallery_id'] : 0;
        $mediaId = isset($input['media_id'])
            ? (int)$input['media_id']
            : (isset($input['id']) ? (int)$input['id'] : 0);
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {

        $userId = $this->resolve_user_id_from_token($token);
        if ($userId === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'User is not logged in or token expired.',
                'media' => null,
            ];
        }

        if ($galleryId <= 0 || $mediaId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id and media id are required.',
                'media' => null,
            ];
        }

        if (!$this->user_owns_gallery($userId, $galleryId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'You do not have permission to edit pictures in this gallery.',
                'media' => null,
            ];
        }

        if (!$this->media_in_gallery($galleryId, $mediaId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Picture not found in this gallery.',
                'media' => null,
            ];
        }

        $updates = [];
        $hasTitle = array_key_exists('title', $input);
        $hasDescription = array_key_exists('description', $input)
            || array_key_exists('descr', $input);

        if ($hasTitle) {
            $title = trim((string)$input['title']);
            if (mb_strlen($title) > 255) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => 'Title must be at most 255 characters.',
                    'media' => null,
                ];
            }
            $updates['title'] = $title !== '' ? $title : null;
        }

        if ($hasDescription) {
            $description = trim((string)($input['description'] ?? $input['descr'] ?? ''));
            $updates['descr'] = $description !== '' ? $description : null;
        }

        if (empty($updates)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'No fields to update.',
                'media' => null,
            ];
        }

        try {
            $this->db->update('media_items', $updates, [
                'media_item_id' => $mediaId,
            ]);

            $result = $this->get_gallery_media_item($galleryId, $mediaId);
            $ok = true;
            return [
                'success' => true,
                'message' => 'Picture updated successfully.',
                'error' => '',
                'media' => $result['media'],
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to update picture.',
                'media' => null,
            ];
        }
        } finally {
            (new LogModel())->record_result('update gallery media', $ok, $actor);
        }
    }

    /**
     * Remove a media item from a gallery (does not delete the media file row).
     * Body: token, gallery_id, media_id.
     *
     * @return array{success:bool,message:string,error:string}
     */
    public function remove_media_from_gallery(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['gallery_id']) ? (int)$input['gallery_id'] : 0;
        $mediaId = isset($input['media_id'])
            ? (int)$input['media_id']
            : (isset($input['id']) ? (int)$input['id'] : 0);
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {

        $userId = $this->resolve_user_id_from_token($token);
        if ($userId === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'User is not logged in or token expired.',
            ];
        }

        if ($galleryId <= 0 || $mediaId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id and media id are required.',
            ];
        }

        if (!$this->user_owns_gallery($userId, $galleryId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'You do not have permission to remove pictures from this gallery.',
            ];
        }

        if (!$this->media_in_gallery($galleryId, $mediaId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Picture not found in this gallery.',
            ];
        }

        try {
            // Clear cover if this picture is the cover
            $coverId = $this->get_gallery_cover_id($galleryId);
            if ($coverId !== null && $coverId === $mediaId) {
                $this->db->update('media_collections', [
                    'collection_cover_id' => null,
                ], [
                    'media_collection_id' => $galleryId,
                ]);
            }

            $this->db->delete('media_in_collection', [
                'media_collection_id' => $galleryId,
                'media_item_id' => $mediaId,
            ]);

            $ok = true;
            return [
                'success' => true,
                'message' => 'Picture removed from gallery.',
                'error' => '',
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to remove picture from gallery.',
            ];
        }
        } finally {
            (new LogModel())->record_result('remove media from gallery', $ok, $actor);
        }
    }

    /**
     * Set gallery cover to a media item that belongs to the gallery.
     * Body: token, gallery_id, media_id.
     *
     * @return array{success:bool,message:string,error:string,gallery:?array}
     */
    public function set_gallery_cover(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['gallery_id']) ? (int)$input['gallery_id'] : 0;
        $mediaId = isset($input['media_id'])
            ? (int)$input['media_id']
            : (isset($input['id']) ? (int)$input['id'] : 0);
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {

        $userId = $this->resolve_user_id_from_token($token);
        if ($userId === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'User is not logged in or token expired.',
                'gallery' => null,
            ];
        }

        if ($galleryId <= 0 || $mediaId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id and media id are required.',
                'gallery' => null,
            ];
        }

        if (!$this->user_owns_gallery($userId, $galleryId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'You do not have permission to change this gallery cover.',
                'gallery' => null,
            ];
        }

        if (!$this->media_in_gallery($galleryId, $mediaId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Picture not found in this gallery.',
                'gallery' => null,
            ];
        }

        try {
            $this->db->update('media_collections', [
                'collection_cover_id' => $mediaId,
            ], [
                'media_collection_id' => $galleryId,
            ]);

            $gallery = $this->get_gallery_by_id($galleryId);
            $ok = true;
            return [
                'success' => true,
                'message' => 'Gallery cover updated successfully.',
                'error' => '',
                'gallery' => $gallery,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to set gallery cover.',
                'gallery' => null,
            ];
        }
        } finally {
            (new LogModel())->record_result('set gallery cover', $ok, $actor);
        }
    }

    /**
     * Delete a gallery (owners, memberships, then collection). Does not delete media files.
     * Body: token, id. Caller must own the gallery.
     *
     * @return array{success:bool,message:string,error:string}
     */
    public function delete_gallery(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['id']) ? (int)$input['id'] : 0;
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {

        $userId = $this->resolve_user_id_from_token($token);
        if ($userId === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'User is not logged in or token expired.',
            ];
        }

        if ($galleryId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id is required.',
            ];
        }

        if ($this->get_gallery_by_id($galleryId) === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery not found.',
            ];
        }

        if (!$this->user_owns_gallery($userId, $galleryId)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'You do not have permission to delete this gallery.',
            ];
        }

        $result = $this->delete_gallery_structure($galleryId, false);
        $ok = !empty($result['success']);
        return $result;
        } finally {
            (new LogModel())->record_result('delete gallery', $ok, $actor);
        }
    }

    /**
     * Admin hard-delete: gallery + all media items in it (DB + disk files).
     * Body: token (admin), id|gallery_id.
     *
     * @return array{success:bool,message:string,error:string,media_deleted:int}
     */
    public function delete_gallery_by_admin(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['id'])
            ? (int)$input['id']
            : (isset($input['gallery_id']) ? (int)$input['gallery_id'] : 0);
        $actor = $this->actor_from_token($token);
        $ok = false;
        try {

        $userModel = new UserModel($this->db);
        $adminCheck = $userModel->verify_admin_by_token($input);
        if (!$adminCheck['success']) {
            return [
                'success' => false,
                'message' => '',
                'error' => $adminCheck['error'] !== ''
                    ? $adminCheck['error']
                    : 'Admin privileges required.',
                'media_deleted' => 0,
            ];
        }

        if ($galleryId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id is required.',
                'media_deleted' => 0,
            ];
        }

        $gallery = $this->get_gallery_by_id($galleryId);
        if ($gallery === null) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery not found.',
                'media_deleted' => 0,
            ];
        }

        try {
            // Clear cover before removing media (FK safety)
            $this->db->update('media_collections', [
                'collection_cover_id' => null,
            ], [
                'media_collection_id' => $galleryId,
            ]);

            $mediaRows = $this->db->queryAll(
                'SELECT media_item_id
                 FROM media_in_collection
                 WHERE media_collection_id = :gid',
                [':gid' => $galleryId]
            );

            $fileModel = new FileModel($this->db);
            $mediaDeleted = 0;
            foreach ($mediaRows as $row) {
                $mediaId = (int)($row['media_item_id'] ?? 0);
                if ($mediaId <= 0) {
                    continue;
                }
                $del = $fileModel->delete_media_item_by_admin([
                    'token' => $token,
                    'media_item_id' => $mediaId,
                ]);
                if (!empty($del['success'])) {
                    $mediaDeleted++;
                }
            }

            // Remove any leftover memberships + owners + collection
            $structure = $this->delete_gallery_structure($galleryId, true);
            if (!$structure['success']) {
                return [
                    'success' => false,
                    'message' => '',
                    'error' => $structure['error'] !== ''
                        ? $structure['error']
                        : 'Media deleted but gallery structure cleanup failed.',
                    'media_deleted' => $mediaDeleted,
                ];
            }

            $title = (string)($gallery['title'] ?? '');
            $ok = true;
            return [
                'success' => true,
                'message' => $title !== ''
                    ? "Gallery \"{$title}\" and {$mediaDeleted} media item(s) deleted."
                    : "Gallery #{$galleryId} and {$mediaDeleted} media item(s) deleted.",
                'error' => '',
                'media_deleted' => $mediaDeleted,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to delete gallery.',
                'media_deleted' => 0,
            ];
        }
        } finally {
            (new LogModel())->record_result('delete gallery - admin', $ok, $actor);
        }
    }

    /**
     * Remove collection structure (memberships, owners, collection row).
     * When $force is true, skips ownership checks (admin path).
     *
     * @return array{success:bool,message:string,error:string}
     */
    private function delete_gallery_structure(int $galleryId, bool $force = false): array
    {
        if ($galleryId <= 0) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Gallery id is required.',
            ];
        }

        try {
            $this->db->update('media_collections', [
                'collection_cover_id' => null,
            ], [
                'media_collection_id' => $galleryId,
            ]);

            $this->db->delete('media_in_collection', [
                'media_collection_id' => $galleryId,
            ]);

            $this->db->delete('collection_owners', [
                'media_collection_id' => $galleryId,
            ]);

            $this->db->delete('media_collections', [
                'media_collection_id' => $galleryId,
            ]);

            return [
                'success' => true,
                'message' => 'Gallery deleted successfully.',
                'error' => '',
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to delete gallery.',
            ];
        }
    }
}
