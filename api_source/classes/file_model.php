<?php
    class FileModel {
        private DatabaseAccess $db;
        protected $upload_folder = __DIR__ . '/../uploads';
        public function __construct(DatabaseAccess $db)
        {
            $this->db = $db;
        }
     

          public function create_file_details_table($folder_path){
            $files = $this->show_files_in_folder($folder_path);
            if(!empty($files)){
                $n = 0;
                $file_details = [];
                foreach($files as $file){
                    $full_path = $folder_path . '/' . $file;
                    $sizeKB = round(filesize($full_path) / 1024, 0);
                    if($sizeKB == 0) $sizeKB = 1;
                    $file_details[$n] = array($file, 
                                            $sizeKB, 
                                            date("Y-m-d H:i:s", filemtime($full_path))
                                            );
                    $n++;
                }
            usort($file_details, function($a, $b) {
                        return strcasecmp($a[0], $b[0]); // Sort by filename (index 0)
                    });
            return $file_details; 
            }
            else return array();

        }
  
  
  
  public function show_files_in_folder($folder_path): array
  {
      $all_items = array_diff(scandir($folder_path), ['.', '..', '.gitkeep', '.DS_Store']);
      $files_only = array_filter($all_items, function($item) use ($folder_path) {
          return is_file($folder_path . '/' . $item);
      });
      return $files_only;
  }

  public function create_uploaded_files_table(){
    return $this->create_file_details_table($this->upload_folder);
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
            if($old_filename === $new_filename){
                return ["renamed"=>false, "error"=>"New filename is the same as the old filename."];
            }
            $file_list = $this->show_files_in_folder($this->upload_folder);
            if(in_array($new_filename, $file_list)){
                return ["renamed"=>false, "error"=>"Filename already exists."];
            }
            //rename file
            $new_file_path = $this->upload_folder . '/' . $new_filename;
            rename($file_path, $new_file_path);
            return ["renamed"=>true, "error"=>""];
        }

    public function delete_file(array $input){
    
    $file_list = $this->show_files_in_folder($this->upload_folder);
    $file_to_delete = $input['file_to_delete'];
    if(in_array($file_to_delete, $file_list)){
         $file_path = $this->upload_folder . '/' . $file_to_delete;
         unlink($file_path);
        return ["deleted"=>true, "error"=>""];
    }
    else{
        return ["deleted"=>false, "error"=>"File does not exist."];
        
      }
        
    }

    public function return_duplicated_file_array(){
         $file_name_list = $_FILES['files']['name'];
         $files_not_duplicated = $this->return_unique_file_array();
         $files_duplicated = array_diff($file_name_list, $files_not_duplicated);
         return $files_duplicated;

    }

    public function return_unique_file_array(){
         $file_name_list = $_FILES['files']['name'];
         $uploaded_files_array = $this->show_files_in_folder($this->upload_folder);
         $files_not_duplicated = array_diff($file_name_list, $uploaded_files_array);
         return $files_not_duplicated;

    }
    
    public function check_extensions($file_name_array,$allowed_extensions){
        $forbidden_file_array = [];
        foreach($file_name_array as $file_name){
            $ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
            if(!in_array($ext, $allowed_extensions)){
                $forbidden_file_array[] = $file_name;
            }
        }
        return $forbidden_file_array;
    }
    
    public function remove_forbidden_files_from_array($file_name_array, $forbidden_file_array){
        return array_diff($file_name_array, $forbidden_file_array);
    }


    public function insert_uploaded_files(array $input){
        $max_files = 5;    
        $token = $input['token'];
        $user = new UserModel($this->db);
        $logged_user_verify = $user->get_by_token($token);
        $upload_message="";
        //Following files were uploaded: $final_upload_string.
        $upload_error ="";
        //"Following file(s) cannot be uploaded (already exist): $files_duplicated_string."
        if(!$logged_user_verify){
            return ["success"=>false, "error"=>"User is not logged in.", "message"=>""];        
        }
        if (empty($_FILES['files']['name'][0])) {
            return ["success"=>false, "error"=>"No files uploaded.", "message"=>""];        
        }
        
        $max_size  = 10 * 1024 * 1024; // 10 MB per file
        $allowed  = ['jpg', 'jpeg', 'png', 'pdf', 'txt', 'docx'];
        $file_name_list = $_FILES['files']['name'];
  
        $unique_upload_file_array = $this->return_unique_file_array(); //should return only unique files not on server
        //check if files are within limits
        if (count($unique_upload_file_array) > $max_files) {
            return ["success"=>false, "error"=>"Maximum $max_files files allowed.", "message"=>""];        
        }
        //check if extensions are allowed
        $forbidden_file_array = $this->check_extensions($unique_upload_file_array, $allowed);
        $unique_with_corr_ext_array = $this->remove_forbidden_files_from_array($unique_upload_file_array, $forbidden_file_array);
        $final_upload_array = $unique_with_corr_ext_array;
        $final_upload_string = implode(', ',  $final_upload_array);
        $files_duplicated = $this->return_duplicated_file_array();
        $files_duplicated_string = implode(', ', $files_duplicated);
        $files_forbidden_string = implode(', ', $forbidden_file_array);
        $upload_error_begining = "Folowing file(s) cannot be uploaded: ";
        $upload_error_body ="";
       if (!empty($files_duplicated) || !empty($forbidden_file_array)) {

    if (!empty($files_duplicated)) {
        $upload_error_body = $upload_error_body . " " . $files_duplicated_string." (duplicated)";
    }

    if (!empty($forbidden_file_array)) {          // ← Changed to if (no else)
        $upload_error_body = $upload_error_body . " " . $files_forbidden_string." (forbidden)";
    }

    $upload_error = $upload_error_begining . $upload_error_body.".";
}
        
             return ["success"=>false, "error"=>$upload_error, "message"=>$upload_message];        
    }
    }
?>