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

   public function getByName(string $name): ?array
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

    public function login(string $email, string $password): ?array
    {
        $user = $this->getByEmail($email);
        if ($user && password_verify($password, $user['password'])) {
            return $user;
        }
        return null;
    }

    public function updateToken(int $userId, ?string $token): bool
    {
        $data = ['token' => $token];
        if ($token === null) {
            $data['token_validity'] = null;
        }
        return $this->db->update('users', $data, ['id' => $userId]);
    }
}

?>