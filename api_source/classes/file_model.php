<?php
class FileModel {
    private DatabaseAccess $db;
    protected string $upload_folder;

    public function __construct(DatabaseAccess $db) {
        $this->db = $db;
        $this->upload_folder = __DIR__ . '/../uploads';
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