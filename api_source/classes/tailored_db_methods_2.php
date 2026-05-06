<?php
    class TailoredDBMethods extends DatabaseAccess {

        private DatabaseAccess $db;

    public function __construct(DatabaseAccess $db)
    {
        $this->db = $db;
    }
        public function display_table_as_object(string $table_name): array
        {
          $result = $this->db->select($table_name);
          return $result;
          // public function select(string $table, array $conditions = [], array $columns = ['*']): array
        }
        public function return_table_as_json(string $table_name): string
        {
          $result = $this->db->select($table_name);
          return json_encode($result);
        }

        public function return_table_for_ui(string $table_name): array
            {
                $rows = $this->db->select($table_name);
                if (empty($rows)) {
                    return [];
                }

                $headers = array_keys($rows[0]);
                $values = array_map('array_values', $rows);

                return array_merge([$headers], $values);
            }
        public function return_table_for_ui_json(string $table_name): string
        {
            $result = $this->return_table_for_ui($table_name);
            return json_encode($result);
        }

        public function send_table_to_frontend(array $input){
                $success= false;
                $message = "";
                $error="";
                $table=[];
                $token = $input['token'] ?? '';
                if(!$token){
                    $error = "Token not found or user not logged in.";
                    return [
                        'success' => $success,
                        'message' => $message,
                        'error' => $error
                    ];
                }
                $user = new UserModel($this->db);
                $admin_test = $user->verify_admin_by_token(['token' => $token]);
                if($admin_test['success']){
                    $success = true;
                    $message = "Table sent to frontend";
                    $table= $this->return_table_for_ui($input['table_name']);
                    // TODO: Send table to frontend
                }
                else {
                    $error = "User nod logeed is or not an admin.";
                    $message = "Table not fetched.";
                }
                return ['success' => $success, 'message' => $message, 'error' => $error, "data"=>$table];
              
        }
    }
?>