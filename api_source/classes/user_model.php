<?php 
class UserModel
{
    private DatabaseAccess $db;

    public function __construct(DatabaseAccess $db)
    {
        $this->db = $db;
    }

    public function getById(int $id): ?array
    {
        return $this->db->selectOne('users', ['id' => $id]);
    }

   public function get_by_name(string $name): ?array
    {
        return $this->db->select('users', ['name' => $name]);
    }

    public function get_by_token(string $token): ?array
    {
        if($this->check_token_validity($token)) {
            return $this->db->select('users', ['token' => $token]);
        }
        return null;
    }



    public function create(string $name,  string $password): int
    {
        return $this->db->insert('users', [
            'name'       => $name,
            'password'   => $verification
            
        ]);
    }

    public function new_user_create(string $name, string $password){
        if(!empty($this->get_by_name($name))){
            return false;
        }
        if(empty($name) || empty($password)){
            return false;
        }
        $pass_regex = '/^(?=.*[A-Z])(?=.*\d).{10,}$/';
        $pass_verify= preg_match($pass_regex, $password);
        $user_regex = '/^[a-zA-Z0-9_]{4,16}$/';
        $username_verify = preg_match($user_regex, $name);
        if(!$pass_verify || !$username_verify){
            return false;
        }
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $this->db->insert('users', [
            'name'       => $name,
            'password'   => $hashed_password
        ]);
        return true;
    }


    public function delete (string $name){
         return $this->db->delete('users', [
            'name'       => $name,
                        
        ]);       
    }

    public function verify_user_password(string $username, string $password){
            $user = $this->get_by_name($username);

         if ($user) {
            
            $test_verify =  password_verify($password, $user[0]["password"]);
            return $test_verify ;
        }
        return false; 

       
    }
    public function login(string $email, string $password): ?array
    {
        $user = $this->getByEmail($email);
        if ($user && password_verify($password, $user['password'])) {
            return $user;
        }
        return null;
    }

    public function create_user_token(string $username, string $token)
    {   
        $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
        $username = $user[0]['name'];
        $this->db->update('users', ['token' => $token], ['name' => $username]);
        return $token;
       
    }

    public function set_token_validity(string $username, int $days=5)
    {   
        $date = new DateTime();
        $date->add(new DateInterval('P' . $days . 'D'));
        $database_format_date = $date->format('Y-m-d H:i:s');
        $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
        $username = $user[0]['name'];
        $this->db->update('users', ['token_validity' => $database_format_date], ['name' => $username]);
        return $database_format_date;
       
    }

    public function set_token_and_validity(string $username, string $token, int $days=5)
    {
        $token=$this->create_user_token($username, $token);
        $validity=$this->set_token_validity($username, $days);
        if(!$token || !$validity){
            return false;
        }
        return [$token, $validity];
    }  
    public function reset_user_token(string $username){
     $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
         
     $username = $user[0]['name'];
     $date = new DateTime();
     $date->modify('-3 days');
     $database_format_date = $date->format('Y-m-d H:i:s');
     $this->db->update('users', ['token_validity' => $database_format_date, 'token' => null], ['name' => $username]);
     return $date;
    }
    

    public function check_token_validity(string $token): bool
    {
        $user = $this->db->select('users', ['token' => $token]);
        if (!$user) {
            return false;
        }
        if(isset($user[0]['token_validity']) && $user[0]['token_validity'] > date('Y-m-d H:i:s')) {
            return true;
        }
        return false;
    }

    public function verify_user_token(string $username, string $token): bool
    {
        $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
       
        $username = $user[0]['name'];
        if ($user && isset($user[0]['token']) && $user[0]['token'] === $token) {
            if($this->check_token_validity($token)) {
                return true;
            }
            else {
                return false;
            }
        }
        return false;
    }
    

    public function reset_user_password( string $username, string $password){
            $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
        $username = $user[0]['name'];
        $this->db->update('users', ['password' => password_hash($password, PASSWORD_DEFAULT)], ['name' => $username]);
        return true;
    }

    public function check_token_existence(string $token) : bool
    {
        $user = $this->db->select('users', ['token' => $token]);
        return !empty($user);
    }

    public function check_if_admin(string $username): bool
    {   

        $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
        return $user[0]['is_admin'] === 1;
    }

    public function verify_admin_by_token(array $input){
       
       $success= false;
        $message = "";
        $error="";
        $token = $input['token'] ?? '';
        if($this->get_by_token($token)) {
            $name = $this->get_by_token($token)[0]['name'];
            $success = $this->check_if_admin($name);
            $message = ($success) ? "User: $name is admin." : "User: $name is not admin.";
        }
        else {
            $error = "Token not found or user not logged in.";
        }
        return [
            "success" => $success,
            "error" => $error,
            "message" => $message
        ];

        
    }

    public function delete_user_by_admin (array $input){
        $success = false;
        $message = "";
        $error = "";
        $user_to_delete = $input['name'] ?? '';
       if(!$this->verify_admin_by_token($input)) {
    $error = "User is not admin.";
    return [
        "success" => $success,
        "error" => $error,
        "message" => $message
    ];
}  // ← closing brace goes HERE

if($this->delete($user_to_delete)) {
    $success = true;
    $message = "User $user_to_delete deleted.";
} else {
    $error = "User $user_to_delete not found.";
}
return [
    "success" => $success,
    "error" => $error,
    "message" => $message
];
        
        
    }

    

}


?>