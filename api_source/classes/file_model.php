<?php
require_once __DIR__ . '/log_model.php';

class FileModel {
    private DatabaseAccess $db;
    protected string $upload_folder;
    protected string $media_items_folder;

    public function __construct(DatabaseAccess $db) {
        $this->db = $db;
        $this->upload_folder = __DIR__ . '/../uploads';
        $this->media_items_folder = __DIR__ . '/../media_items';
    }

    private function getUploadConfig(): array
{
    return [
        'max_files'      => (int)(getenv('UPLOAD_MAX_FILES')       ?? 5),
        'max_size_mb'    => (int)(getenv('UPLOAD_MAX_SIZE_MB')     ?? 10),
        'allowed_ext'    => array_map('trim', 
                            explode(',', getenv('UPLOAD_ALLOWED_EXTENSIONS') ?? 'jpg,jpeg,png,pdf,txt,docx')),
        
    ];
}

    public function create_uploaded_files_table() {
        return $this->create_file_details_table($this->upload_folder);
    }

    public function create_file_details_table(string $folder_path) {
        $files = $this->show_files_in_folder($folder_path);
        if (empty($files)) {
            return [];
        }

        $file_details = [];
        foreach ($files as $file) {
            $full_path = $folder_path . '/' . $file;
            $sizeKB = max(1, (int)round(filesize($full_path) / 1024));

            $file_details[] = [
                $file,
                $sizeKB,
                date("Y-m-d H:i:s", filemtime($full_path))
            ];
        }

        usort($file_details, fn($a, $b) => strcasecmp($a[0], $b[0]));
        return $file_details;
    }

    public function show_files_in_folder(string $folder_path): array {
        $all_items = array_diff(scandir($folder_path), ['.', '..', '.gitkeep', '.DS_Store']);
        return array_filter($all_items, fn($item) => is_file($folder_path . '/' . $item));
    }

    // ====================== FILE OPERATIONS ======================

    public function rename_file(array $input) {
        $old_filename = $input['old_filename'] ?? '';
        $new_filename = $input['new_filename'] ?? '';
        $token = $input['token'] ?? '';
        $username = $this->username_from_token($token);
        $ok = false;
        try {
        $user = new UserModel($this->db);
        if (!$user->get_by_token($token)) {
            return ["renamed" => false, "error" => "User is not logged in."];
        }

        if (!preg_match('/^[a-zA-Z0-9._\-\s]{5,50}$/', $new_filename)) {
            return ["renamed" => false, "error" => "Filename does not meet the requirements."];
        }

        $old_path = $this->upload_folder . '/' . $old_filename;
        $new_path = $this->upload_folder . '/' . $new_filename;

        if (!file_exists($old_path)) {
            return ["renamed" => false, "error" => "File does not exist."];
        }
        if ($old_filename === $new_filename) {
            return ["renamed" => false, "error" => "New filename is the same as the old filename."];
        }
        if (file_exists($new_path)) {
            return ["renamed" => false, "error" => "Filename already exists."];
        }

        rename($old_path, $new_path);
        $ok = true;
        return ["renamed" => true, "error" => ""];
        } finally {
            (new LogModel())->record_result('rename file', $ok, $username);
        }
    }
    /**
     * Delete one file from media_items/ folder by basename.
     * Returns true if the file existed and was removed.
     */
    private function delete_media_item_file(string $filename): bool
    {
        $filename = basename(trim($filename));
        if ($filename === '' || $filename === '.' || $filename === '..') {
            return false;
        }

        $file_path = $this->media_items_folder . '/' . $filename;
        if (file_exists($file_path) && is_file($file_path)) {
            return unlink($file_path);
        }
        return false;
    }

    /**
     * Derive miniature basename (Image_00001.jpeg → Image_00001_sm.jpeg).
     */
    private function to_media_miniature_filename(string $filename): string
    {
        $filename = basename(trim($filename));
        $base = pathinfo($filename, PATHINFO_FILENAME);
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        if ($base === '') {
            return '';
        }
        return $ext !== '' ? "{$base}_sm.{$ext}" : "{$base}_sm";
    }

    /**
     * Standard response shape for media-item delete operations.
     *
     * @return array{
     *   success:bool,
     *   message:string,
     *   error:string,
     *   deleted:bool,
     *   media_item_id:?int,
     *   file_id:?int,
     *   filename:?string,
     *   files_removed:array<int,string>
     * }
     */
    private function media_delete_response(
        bool $success,
        string $message = '',
        string $error = '',
        bool $deleted = false,
        ?int $mediaItemId = null,
        ?int $fileId = null,
        ?string $filename = null,
        array $filesRemoved = []
    ): array {
        return [
            'success' => $success,
            'message' => $message,
            'error' => $error,
            'deleted' => $deleted,
            'media_item_id' => $mediaItemId,
            'file_id' => $fileId,
            'filename' => $filename,
            'files_removed' => $filesRemoved,
        ];
    }

    /**
     * Resolve media_item_id + file row from input (media_item_id / media_id / id / filename).
     *
     * @return array{media_item_id:int,file_id:int,filename:string}|null
     */
    private function resolve_media_item_for_delete(array $input): ?array
    {
        $mediaItemId = 0;
        if (isset($input['media_item_id'])) {
            $mediaItemId = (int)$input['media_item_id'];
        } elseif (isset($input['media_id'])) {
            $mediaItemId = (int)$input['media_id'];
        } elseif (isset($input['id'])) {
            $mediaItemId = (int)$input['id'];
        }

        $filenameHint = trim((string)($input['filename'] ?? $input['file'] ?? ''));
        $filenameHint = $filenameHint !== '' ? basename($filenameHint) : '';

        if ($mediaItemId > 0) {
            $rows = $this->db->queryAll(
                'SELECT mi.media_item_id, mi.file_id, f.filename
                 FROM media_items mi
                 INNER JOIN files f ON f.file_id = mi.file_id
                 WHERE mi.media_item_id = :media_id
                 LIMIT 1',
                [':media_id' => $mediaItemId]
            );
            if (empty($rows)) {
                return null;
            }
            $row = $rows[0];
            return [
                'media_item_id' => (int)$row['media_item_id'],
                'file_id' => (int)$row['file_id'],
                'filename' => (string)($row['filename'] ?? ''),
            ];
        }

        if ($filenameHint !== '') {
            $rows = $this->db->queryAll(
                'SELECT mi.media_item_id, mi.file_id, f.filename
                 FROM media_items mi
                 INNER JOIN files f ON f.file_id = mi.file_id
                 WHERE f.filename = :filename
                 LIMIT 1',
                [':filename' => $filenameHint]
            );
            if (empty($rows)) {
                return null;
            }
            $row = $rows[0];
            return [
                'media_item_id' => (int)$row['media_item_id'],
                'file_id' => (int)$row['file_id'],
                'filename' => (string)($row['filename'] ?? ''),
            ];
        }

        return null;
    }

    /**
     * Core delete: disk files (full + miniature) + DB relations for one media item.
     * Caller must already authenticate.
     */
    private function delete_media_item_core(array $input): array
    {
        $resolved = $this->resolve_media_item_for_delete($input);
        if ($resolved === null) {
            return $this->media_delete_response(
                false,
                '',
                'Media item not found. Provide media_item_id (or media_id/id) or filename.'
            );
        }

        $mediaItemId = $resolved['media_item_id'];
        $fileId = $resolved['file_id'];
        $filename = $resolved['filename'];

        if ($filename === '') {
            return $this->media_delete_response(
                false,
                '',
                'Media item has no filename on record.',
                false,
                $mediaItemId,
                $fileId,
                null
            );
        }

        try {
            // Clear gallery covers pointing at this media item
            $this->db->update(
                'media_collections',
                ['collection_cover_id' => null],
                ['collection_cover_id' => $mediaItemId]
            );

            // Membership links
            $this->db->delete('media_in_collection', [
                'media_item_id' => $mediaItemId,
            ]);
            $this->db->delete('media_in_post', [
                'media_item_id' => $mediaItemId,
            ]);

            // media_items → files (FK order)
            $this->db->delete('media_items', [
                'media_item_id' => $mediaItemId,
            ]);
            $this->db->delete('files', [
                'file_id' => $fileId,
            ]);

            // Physical files via delete_media_item_file
            $filesRemoved = [];
            if ($this->delete_media_item_file($filename)) {
                $filesRemoved[] = $filename;
            }
            $miniature = $this->to_media_miniature_filename($filename);
            if ($miniature !== '' && $this->delete_media_item_file($miniature)) {
                $filesRemoved[] = $miniature;
            }

            return $this->media_delete_response(
                true,
                'Media item deleted successfully.',
                '',
                true,
                $mediaItemId,
                $fileId,
                $filename,
                $filesRemoved
            );
        } catch (Throwable $e) {
            return $this->media_delete_response(
                false,
                '',
                'Failed to delete media item.',
                false,
                $mediaItemId,
                $fileId,
                $filename
            );
        }
    }

    /**
     * Delete a media item as a logged-in user (token required).
     * Body: token, media_item_id|media_id|id (or filename).
     */
    public function delete_media_item_by_user(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $username = '-';
        $ok = false;
        try {
        if ($token === '') {
            return $this->media_delete_response(false, '', 'Token is required.');
        }

        $userModel = new UserModel($this->db);
        $users = $userModel->get_by_token($token);
        if (empty($users)) {
            return $this->media_delete_response(
                false,
                '',
                'User is not logged in or token expired.'
            );
        }

        $username = (string)($users[0]['name'] ?? '-');
        $result = $this->delete_media_item_core($input);
        $ok = !empty($result['success']);
        return $result;
        } finally {
            (new LogModel())->record_result('delete media item', $ok, $username);
        }
    }

    /**
     * Delete a media item as admin (token + is_admin via check_if_admin).
     * Body: token, media_item_id|media_id|id (or filename).
     */
    public function delete_media_item_by_admin(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
        $username = '-';
        $ok = false;
        try {
        if ($token === '') {
            return $this->media_delete_response(false, '', 'Token is required.');
        }

        $userModel = new UserModel($this->db);
        $users = $userModel->get_by_token($token);
        if (empty($users)) {
            return $this->media_delete_response(
                false,
                '',
                'User is not logged in or token expired.'
            );
        }

        $username = (string)($users[0]['name'] ?? '');
        if ($username === '' || !$userModel->check_if_admin($username)) {
            return $this->media_delete_response(
                false,
                '',
                'Admin privileges required.'
            );
        }

        $result = $this->delete_media_item_core($input);
        $ok = !empty($result['success']);
        return $result;
        } finally {
            (new LogModel())->record_result('delete media item - admin', $ok, $username !== '' ? $username : '-');
        }
    }

    /**
     * Upload a single picture into a gallery.
     *
     * Multipart fields:
     *   token, gallery_id, title, description, file (single image)
     *
     * Processing (see ImageManipulator constants / env):
     *   - convert to JPEG
     *   - full: long side ≤ 1920 (no upscale)
     *   - watermark bottom-right "Donbigosso Galleries"
     *   - miniature: long side ≤ 300, name {base}_sm.jpg
     *   - filename: media_item_{username}_{media_item_id}.jpg
     *   - EXIF GPS → decimal JSON in media_items.coordinates
     *
     * @return array{
     *   success:bool,message:string,error:string,media:?array,gallery_id:?int
     * }
     */
    public function upload_gallery_media(array $input): array
    {
        $username = '-';
        $ok = false;
        try {
        $token = trim((string)($input['token'] ?? ''));
        $galleryId = isset($input['gallery_id'])
            ? (int)$input['gallery_id']
            : (isset($input['id']) ? (int)$input['id'] : 0);
        $title = trim((string)($input['title'] ?? ''));
        $description = trim((string)($input['description'] ?? $input['descr'] ?? ''));

        if ($token === '') {
            return $this->gallery_media_upload_fail('Token is required.');
        }
        if ($galleryId <= 0) {
            return $this->gallery_media_upload_fail('Gallery id is required.');
        }
        if ($title === '') {
            return $this->gallery_media_upload_fail('Title is required.');
        }
        if (mb_strlen($title) > 255) {
            return $this->gallery_media_upload_fail('Title must be at most 255 characters.');
        }
        if ($description === '') {
            return $this->gallery_media_upload_fail('Description is required.');
        }

        $userModel = new UserModel($this->db);
        $users = $userModel->get_by_token($token);
        if (empty($users)) {
            return $this->gallery_media_upload_fail('User is not logged in or token expired.');
        }

        $userId = (int)($users[0]['user_id'] ?? 0);
        $username = (string)($users[0]['name'] ?? '');
        if ($userId <= 0 || $username === '') {
            $username = '-';
            return $this->gallery_media_upload_fail('Could not resolve user.');
        }

        $galleryModel = new GalleryModel($this->db);
        if ($galleryModel->get_gallery_by_id($galleryId) === null) {
            return $this->gallery_media_upload_fail('Gallery not found.');
        }
        if (!$galleryModel->user_owns_gallery($userId, $galleryId)) {
            return $this->gallery_media_upload_fail(
                'You do not have permission to upload to this gallery.'
            );
        }

        $file = $this->extract_single_upload_file();
        if ($file === null) {
            return $this->gallery_media_upload_fail(
                'Exactly one image file is required (field name: file).'
            );
        }
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return $this->gallery_media_upload_fail(
                'Upload failed (error code ' . (int)$file['error'] . ').'
            );
        }

        $tmpPath = (string)($file['tmp_name'] ?? '');
        if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
            return $this->gallery_media_upload_fail('Invalid uploaded file.');
        }

        $config = $this->getUploadConfig();
        $maxBytes = max(1, (int)$config['max_size_mb']) * 1024 * 1024;
        $size = (int)($file['size'] ?? 0);
        if ($size <= 0 || $size > $maxBytes) {
            return $this->gallery_media_upload_fail(
                'File is empty or exceeds max size of ' . $config['max_size_mb'] . ' MB.'
            );
        }

        $origName = (string)($file['name'] ?? 'image');
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array($ext, $imageExts, true)) {
            return $this->gallery_media_upload_fail(
                'Unsupported image type. Allowed: ' . implode(', ', $imageExts) . '.'
            );
        }

        if (!extension_loaded('gd')) {
            return $this->gallery_media_upload_fail(
                'Server image library (GD) is not available. Rebuild the PHP container.'
            );
        }

        $manipulator = new ImageManipulator();
        if (!$manipulator->loadFromFile($tmpPath)) {
            return $this->gallery_media_upload_fail(
                'Could not read the image. Use a valid JPG, PNG, GIF, or WEBP file.'
            );
        }

        $coordinatesJson = $manipulator->getDecimalCoordinatesJson();
        // From EXIF DateTimeOriginal / DateTimeDigitized / DateTime, or null if missing
        $creationDate = $manipulator->getCreationDateFromExif();

        // Full image: resize if needed, then watermark
        $manipulator->resizeIfLongerSideExceeds($manipulator->getFullMaxLongSide());
        $manipulator->addWatermarkBottomRight();

        // Reserve DB rows first so we know media_item_id for the final filename
        $safeUser = preg_replace('/[^a-zA-Z0-9_]/', '_', $username) ?: 'user';
        $placeholderName = 'media_item_' . $safeUser . '_pending_' . bin2hex(random_bytes(4)) . '.jpg';

        try {
            $fileId = (int)$this->db->insert('files', [
                'filename' => $placeholderName,
                'size_in_kb' => max(1, (int)round($size / 1024)),
            ]);
            if ($fileId <= 0) {
                $manipulator->destroy();
                return $this->gallery_media_upload_fail('Failed to create file record.');
            }

            $mediaItemId = (int)$this->db->insert('media_items', [
                'media_type' => 'PIC',
                'file_id' => $fileId,
                'title' => $title,
                'descr' => $description,
                'tags' => null,
                'coordinates' => $coordinatesJson,
                'creation_date' => $creationDate,
            ]);
            if ($mediaItemId <= 0) {
                $this->db->delete('files', ['file_id' => $fileId]);
                $manipulator->destroy();
                return $this->gallery_media_upload_fail('Failed to create media item.');
            }

            $finalBasename = 'media_item_' . $safeUser . '_' . $mediaItemId . '.jpg';
            $miniBasename = 'media_item_' . $safeUser . '_' . $mediaItemId . '_sm.jpg';
            $fullPath = $this->media_items_folder . '/' . $finalBasename;
            $miniPath = $this->media_items_folder . '/' . $miniBasename;

            if (!is_dir($this->media_items_folder)) {
                @mkdir($this->media_items_folder, 0755, true);
            }

            if (!$manipulator->saveJpeg($fullPath)) {
                $this->rollback_media_upload($mediaItemId, $fileId, null, null);
                $manipulator->destroy();
                return $this->gallery_media_upload_fail('Failed to save full-size image.');
            }

            if (!$manipulator->saveMiniatureJpeg($miniPath)) {
                $this->rollback_media_upload($mediaItemId, $fileId, $fullPath, null);
                $manipulator->destroy();
                return $this->gallery_media_upload_fail('Failed to save miniature image.');
            }

            $manipulator->destroy();

            $sizeKb = max(1, (int)round(filesize($fullPath) / 1024));
            $this->db->update('files', [
                'filename' => $finalBasename,
                'size_in_kb' => $sizeKb,
            ], [
                'file_id' => $fileId,
            ]);

            $this->db->insert('media_in_collection', [
                'media_item_id' => $mediaItemId,
                'media_collection_id' => $galleryId,
            ]);

            // If gallery has no cover yet, use this picture
            $gallery = $galleryModel->get_gallery_by_id($galleryId);
            if ($gallery && empty($gallery['collection_cover_id'])) {
                $this->db->update('media_collections', [
                    'collection_cover_id' => $mediaItemId,
                ], [
                    'media_collection_id' => $galleryId,
                ]);
            }

            $mediaResult = $galleryModel->get_gallery_media_item($galleryId, $mediaItemId);

            $ok = true;
            return [
                'success' => true,
                'message' => 'Picture uploaded successfully.',
                'error' => '',
                'media' => $mediaResult['media'] ?? [
                    'id' => $mediaItemId,
                    'media_type' => 'PIC',
                    'title' => $title,
                    'description' => $description,
                    'tags' => null,
                    'filename' => $finalBasename,
                    'miniature_filename' => $miniBasename,
                    'date_added' => date('Y-m-d H:i:s'),
                ],
                'gallery_id' => $galleryId,
            ];
        } catch (Throwable $e) {
            $manipulator->destroy();
            return $this->gallery_media_upload_fail('Failed to upload picture.');
        }
        } finally {
            (new LogModel())->record_result('upload gallery media', $ok, $username !== '' ? $username : '-');
        }
    }

    /**
     * @return array{name:string,type:string,tmp_name:string,error:int,size:int}|null
     */
    private function extract_single_upload_file(): ?array
    {
        // Preferred: single field "file"
        if (isset($_FILES['file']) && is_array($_FILES['file'])) {
            if (is_array($_FILES['file']['name'] ?? null)) {
                // Unexpected multi under "file"
                if (count($_FILES['file']['name']) !== 1) {
                    return null;
                }
                return [
                    'name' => (string)$_FILES['file']['name'][0],
                    'type' => (string)($_FILES['file']['type'][0] ?? ''),
                    'tmp_name' => (string)$_FILES['file']['tmp_name'][0],
                    'error' => (int)$_FILES['file']['error'][0],
                    'size' => (int)$_FILES['file']['size'][0],
                ];
            }
            return [
                'name' => (string)($_FILES['file']['name'] ?? ''),
                'type' => (string)($_FILES['file']['type'] ?? ''),
                'tmp_name' => (string)($_FILES['file']['tmp_name'] ?? ''),
                'error' => (int)($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE),
                'size' => (int)($_FILES['file']['size'] ?? 0),
            ];
        }

        // Fallback: files[] with exactly one entry
        if (isset($_FILES['files']) && is_array($_FILES['files']['name'] ?? null)) {
            if (count($_FILES['files']['name']) !== 1) {
                return null;
            }
            return [
                'name' => (string)$_FILES['files']['name'][0],
                'type' => (string)($_FILES['files']['type'][0] ?? ''),
                'tmp_name' => (string)$_FILES['files']['tmp_name'][0],
                'error' => (int)$_FILES['files']['error'][0],
                'size' => (int)$_FILES['files']['size'][0],
            ];
        }

        return null;
    }

    private function gallery_media_upload_fail(string $error): array
    {
        return [
            'success' => false,
            'message' => '',
            'error' => $error,
            'media' => null,
            'gallery_id' => null,
        ];
    }

    private function rollback_media_upload(
        int $mediaItemId,
        int $fileId,
        ?string $fullPath,
        ?string $miniPath
    ): void {
        try {
            if ($mediaItemId > 0) {
                $this->db->delete('media_in_collection', ['media_item_id' => $mediaItemId]);
                $this->db->delete('media_items', ['media_item_id' => $mediaItemId]);
            }
            if ($fileId > 0) {
                $this->db->delete('files', ['file_id' => $fileId]);
            }
        } catch (Throwable $e) {
            // best-effort
        }
        if ($fullPath && is_file($fullPath)) {
            @unlink($fullPath);
        }
        if ($miniPath && is_file($miniPath)) {
            @unlink($miniPath);
        }
    }

    public function delete_file(array $input) {
        $file_to_delete = $input['file_to_delete'] ?? '';
        $username = $this->username_from_token((string)($input['token'] ?? ''));
        $ok = false;
        try {
        $file_list = $this->show_files_in_folder($this->upload_folder);

        if (in_array($file_to_delete, $file_list)) {
            unlink($this->upload_folder . '/' . $file_to_delete);
            $ok = true;
            return ["deleted" => true, "error" => ""];
        }
        return ["deleted" => false, "error" => "File does not exist."];
        } finally {
            (new LogModel())->record_result('delete file', $ok, $username);
        }
    }

    // ====================== UPLOAD HELPERS ======================

    public function insert_uploaded_files(array $input) {
        $token = $input['token'] ?? '';
        $username = $this->username_from_token((string)$token);
        $ok = false;
        try {
        $user = new UserModel($this->db);

        if (!$user->get_by_token($token)) {
            return ["success" => false, "error" => "User is not logged in.", "message" => ""];
        }

        if (empty($_FILES['files']['name'][0] ?? '')) {
            return ["success" => false, "error" => "No files uploaded.", "message" => ""];
        }

        $config = $this->getUploadConfig();

    $max_files = $config['max_files'];
    $max_size  = $config['max_size_mb']*1024*1024;
    $allowed   = $config['allowed_ext'];
    $message = "";
    $error = "";
    $error_file_count =0;

        $all_files = $_FILES['files']['name'];
        $unique_files = array_diff($all_files, $this->show_files_in_folder($this->upload_folder));

        if (count($unique_files) > $max_files) {
            return ["success" => false, "error" => "Maximum $max_files files allowed.", "message" => ""];
        }

        // Forbidden extensions
        $forbidden = $this->check_extensions($unique_files, $allowed);
        $valid_ext_files = array_diff($unique_files, $forbidden);

        // Too large
        $too_large = $this->check_file_size($valid_ext_files, $max_size);
        $valid_ext_and_corr_size = array_diff($valid_ext_files, $too_large);
        $with_server_errors = $this->check_server_errors($valid_ext_and_corr_size);
        $final_files = array_diff($valid_ext_files, $with_server_errors);
        $duplicated = array_diff($all_files, $unique_files);
        $error_file_count= count($all_files) - count($final_files);

        $error_parts = [];
        if ($duplicated) $error_parts[] = implode(', ', $duplicated) . " (duplicated)";
        if ($forbidden) $error_parts[] = implode(', ', $forbidden) . " (forbidden extension)";
        if ($too_large) $error_parts[] = implode(', ', $too_large) . " (too large)";
        if ($with_server_errors) $error_parts[] = implode(', ', $with_server_errors) . " (server error)";
        if (!empty($final_files)) {
            $count = count($final_files);
            $file_list = implode(', ', $final_files); 
            $message = ($count === 1) 
                ? "1 file was uploaded: $file_list." 
                : "$count files were uploaded: $file_list.";
        } else {
            $message = "";
        }
        if ($error_parts) {
            $error = "Following " . $error_file_count . " file(s) cannot be uploaded: " . implode(", ", $error_parts) . ".";
            /*$upload_test=implode(", ",$this->move_files_to_server($final_files));
            return ["success" => false, "error" => $error, "message" =>$message.$upload_test];*/
        }
       $this->move_files_to_server($final_files);

        $final_file_details = [];
        foreach ($final_files as $name) {
            $full_path = $this->upload_folder . '/' . $name;
            if (file_exists($full_path)) {
                $final_file_details[] = [
                    $name,max(1, (int)round(filesize($full_path) / 1024)),  
                   date("Y-m-d H:i:s", filemtime($full_path))
                ];
            }
        }

        $ok = !empty($final_file_details);
        return [
            "success" => true,
            "error" => $error,
            "message" => $message,
            "uploaded_files" => $final_file_details
        ];
        } finally {
            (new LogModel())->record_result('upload file', $ok, $username);
        }
    }

    public function check_extensions(array $file_names, array $allowed): array {
        $bad = [];
        foreach ($file_names as $name) {
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed, true)) {
                $bad[] = $name;
            }
        }
        return $bad;
    }

    public function check_file_size(array $file_names, int $max_size): array {
        $too_large = [];
        $sizes = $_FILES['files']['size'] ?? [];
        $names = $_FILES['files']['name'] ?? [];

        foreach ($names as $i => $name) {
            if (in_array($name, $file_names) && ($sizes[$i] ?? 0) > $max_size) {
                $too_large[] = $name;
            }
        }
        return $too_large;
    }

public function check_server_errors(array $file_name_list): array
{
    $errors = [];
    $errorCodes = $_FILES['files']['error'];
    $fileNames  = $_FILES['files']['name'];

    foreach ($errorCodes as $i => $errorCode) {
        $name = $fileNames[$i] ?? 'Unknown file';

        // ONLY check files that are in the provided $file_name_list
        if (!in_array($name, $file_name_list, true)) {
            continue;   // skip this file
        }

        // If there is an actual upload error
        if ($errorCode !== UPLOAD_ERR_OK) {
            $readableMessage = $this->get_upload_error_message($errorCode);

            $errors[] = [
                'file'    => $name,
                'code'    => $errorCode,
                'message' => $readableMessage
            ];
        }
    }

    return $errors;
}

    public function move_files_to_server($file_list){
        $file_names= $_FILES['files']['name'];
        $file_temp_names = $_FILES['files']['tmp_name'];
        $move_results =[];
        foreach ($file_names as $index => $name) {
            if (in_array($name, $file_list)) {
                // TODO: Move the file
                $temp_name = $file_temp_names[$index];
                
                $target = $this->upload_folder."/".$name;
              
                $move_result = move_uploaded_file($temp_name, $target);
                $move_results[] = $move_result;

                 /*
         $target = $uploadDir . time() . "_" . basename($name);

        if (move_uploaded_file($tmp, $target)) {
            $success[] = $name;
        } else {
            $errors[] = "$name → cannot save";
        }
        */ 


            }
        }
        
        return $move_results;
    }

    private function username_from_token(string $token): string
    {
        $token = trim($token);
        if ($token === '') {
            return '-';
        }
        $users = (new UserModel($this->db))->get_by_token($token);
        return !empty($users[0]['name']) ? (string)$users[0]['name'] : '-';
    }
}