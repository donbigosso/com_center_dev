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
}
