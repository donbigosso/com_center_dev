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

    public function create(string $name,  string $password): int
    {
        return $this->db->insert('users', [
            'name'       => $name,
            'password'   => password_hash($password, PASSWORD_DEFAULT)
            
        ]);
    }


    public function delete (string $name){
         return $this->db->delete('users', [
            'name'       => $name,
                        
        ]);       
    }

    public function verify_user_password(string $username, string $password){
            $user = $this->get_by_name($username);

         if ($user[0]) {
            
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
    

    public function verify_user_token(string $username, string $token): bool
    {
        $user = $this->get_by_name($username);
        if (!$user) {
            return false;
        }
       
        $username = $user[0]['name'];
        if ($user && isset($user[0]['token']) && $user[0]['token'] === $token) {
            if(isset($user[0]['token_validity']) && $user[0]['token_validity'] > date('Y-m-d H:i:s')) {
                return true;
            }
            else {
                return false;
            }
        }
        return false;
    }
}

?>