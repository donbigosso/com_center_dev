<?php
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
        return ["renamed" => true, "error" => ""];
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

        return $this->delete_media_item_core($input);
    }

    /**
     * Delete a media item as admin (token + is_admin via check_if_admin).
     * Body: token, media_item_id|media_id|id (or filename).
     */
    public function delete_media_item_by_admin(array $input): array
    {
        $token = trim((string)($input['token'] ?? ''));
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

        return $this->delete_media_item_core($input);
    }

    public function delete_file(array $input) {
        $file_to_delete = $input['file_to_delete'] ?? '';
        $file_list = $this->show_files_in_folder($this->upload_folder);

        if (in_array($file_to_delete, $file_list)) {
            unlink($this->upload_folder . '/' . $file_to_delete);
            return ["deleted" => true, "error" => ""];
        }
        return ["deleted" => false, "error" => "File does not exist."];
    }

    // ====================== UPLOAD HELPERS ======================

    public function insert_uploaded_files(array $input) {
        $token = $input['token'] ?? '';
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

        return [
            "success" => true,
            "error" => $error,
            "message" => $message,
            "uploaded_files" => $final_file_details
        ];
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
}