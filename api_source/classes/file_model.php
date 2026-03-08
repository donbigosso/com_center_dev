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
        return "file found";
    }
    return $file_list;
    }
        
    }
?>