<?php
    class FileModel {
        private DatabaseAccess $db;
        protected $upload_folder = __DIR__ . '/../uploads';
        public function __construct(DatabaseAccess $db)
        {
            $this->db = $db;
        }
        public function rename_file(array $input){
            $old_filename = $input['old_filename'];
            $new_filename = $input['new_filename'];
            $token = $input['token'];
            $user = new UserModel($this->db);
            $logged_user_verify = $user->get_by_token($token);
            if(!$logged_user_verify){
                return ["renamed"=>false, "error"=>"User is not logged in."];
            }
            $filename_regEx = '/^[a-zA-Z0-9._\-\s]{5,50}$/';
            $filename_test = preg_match($filename_regEx, $new_filename);
            if(!$filename_test){
                return ["renamed"=>false, "error"=>"Filename does not meet the requirements."];
            }
            $file_path = $this->upload_folder . '/' . $old_filename;
            $file_exist  = file_exists($file_path);
            if(!$file_exist){
                return ["renamed"=>false, "error"=>"File does not exist."];
            }
            //rename file
            $new_file_path = $this->upload_folder . '/' . $new_filename;
            rename($file_path, $new_file_path);
            return ["renamed"=>true, "error"=>""];
        }
    }
?>