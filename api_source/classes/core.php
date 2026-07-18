<?php
class Core
{
  public function JSONencode(array $data): string
  {
      return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  }

  public function JSONdecode(string $json): array
  {
      return json_decode($json, true);
  }

 private function check_session_token_existence(){
    if(!isset($_SESSION['token'])){
        return false;
    }
  
    return true;
 }

 public function check_user_for_token($dba){
    if($this->check_session_token_existence()){
        $token = $_SESSION['token'];
        $user = new UserModel($dba);
        $username = null;
        if($user->get_by_token($token)){
            $result = $user->get_by_token($token);
            $username = $result[0]['name'];
        }
        return $username;
    }
    return false;
 }

public function redirect_to_login_screen($dba){
    if(!$this->check_user_for_token($dba)){
        header('Location: ./login.php');
        exit;
    }
}

public function auto_log_user($dba){
    if($this->check_user_for_token($dba)){
        header('Location: ./');
        exit;
    }
}

public function return_file_settings(){
    return ['UPLOAD_MAX_FILES'=>getenv('UPLOAD_MAX_FILES') ?: 5,
            'UPLOAD_MAX_SIZE_MB'=>getenv('UPLOAD_MAX_SIZE_MB') ?: 10,
            'UPLOAD_ALLOWED_EXTENSIONS'=>getenv('UPLOAD_ALLOWED_EXTENSIONS') ?: 'jpg,jpeg,png,pdf,txt,docx,mp3,mp4,xlsx,zip,mov'];
}


}

?>