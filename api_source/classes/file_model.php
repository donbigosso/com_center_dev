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
                return false;
            }
            return [$this->upload_folder, $old_filename, $new_filename, $logged_user_verify];
        }
    }
?>