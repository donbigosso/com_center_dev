<?php

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
}
