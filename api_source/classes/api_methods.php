<?php

class ApiMethods extends Core
{
    private $db_access;
     function __construct($db_access) {
     $this->db_access = $db_access; }
    /**
     * Create a standardized API response array
     */
    protected function create_api_response_array(
        bool $success,
        string $message = "",
        string $warning = "",
        string $error = "",
        array $data = []
    ): array {
        return [
            "success" => $success,
            "message" => $message,
            "warning" => $warning,
            "error"   => $error,
            "data"    => $data
        ];
    }

    /**
     * Main entry point: Process the incoming request and route accordingly
     */
    public function processRequest(): void
    {
        // Ensure a request method exists
        if (!isset($_SERVER['REQUEST_METHOD'])) {
            $this->send_JSON_Response(false, "", "", "No request method detected.");
            return;
        }

        $method = $_SERVER['REQUEST_METHOD'];

        switch ($method) {
            case 'GET':
                $this->handleGetRequest();
                break;
            case 'POST':
                $this->handlePostRequest();
                break;
            case 'PUT':
            case 'DELETE':
            case 'PATCH':
                $this->send_JSON_Response(false, "", "", "Method $method not implemented.");
                break;
            default:
                $this->send_JSON_Response(false, "", "", "Invalid request method: $method");
                break;
        }
    }

    /**
     * Handle GET requests - override or extend this in child classes
     */
    protected function handleGetRequest(): void
    {
        // Example: Fetch data, list resources, etc.
        // You can access $_GET here safely
        $input = $_GET;

        // Example logic (replace with your actual needs)
        if (empty($input)) {
            $this->send_JSON_Response(false, "", "", "No GET parameters provided.");
            return;
        }

        // Dummy example request
        if (isset($input['request'])){
            switch ($input['request']) {
                case 'list_users':
                    $users = ['Alice', 'Bob', 'Charlie'];
                    $this->send_JSON_Response(true, "Users retrieved successfully.", "", "", ['users' => $users]);
                    break;
                case 'list_files':{
                   
                    $file_model = new FileModel($this->db_access);
                    $this->send_JSON_Response(true, "Files requested", "", "", ['files' => $file_model->create_uploaded_files_table()]);
                    break;
                }
                case 'download':
                    $this->handle_download();
                    break;
                
                default:
                $this->send_JSON_Response(false, "", "", "Unknown 'request' value: " . $input['request']);
            }
        } 
        else
        {
            $this->send_JSON_Response(false, "", "", "Missing 'request' parameter.");
        }
    }

    


    /**
     * Handle POST requests - override or extend this in child classes
     */
    protected function handlePostRequest(): void
    {
        // For POST, prefer JSON input (common in APIs), fallback to $_POST
        $input = $this->getInputData();

        // Example validation
        if (empty($input)) {
            $this->send_JSON_Response(false, "", "", "No data received in request body.");
            return;
        }

        // Dummy example request
        if (isset($input['request'])) {
            switch ($input['request']) {
                case 'create_user':
                   $this->new_handel_user_create($input);
                    break;
                case 'delete_user':
                    $this->handle_delete_user($input);
                    break;

                case 'login':
                    // Add login logic here
                    $this->send_JSON_Response(true, "Login successful (mock).", "", "", ['token' => 'abc123']);
                    break;
                case 'verify_user_password':
                     $this->verify_user_password($input);
                    break;
                case 'clear_token':
                    $this->handle_clear_token($input);
                    break;
                case 'set_user_token':
                    $this->handle_set_token_and_validity($input);
                    break;
                case 'reset_password':
                    $this->handle_password_reset($input);
                    break;
               
                case 'get_user_by_token':
                    $this->handle_get_user_by_token($input);
                    break;

                case 'rename_file':
                    $this->handle_rename_file($input);
                    break;
                case 'delete_file':
                    $this->handle_delete_file($input);
                    break;
                case 'upload_files':
                    $this->handle_upload_files($input);
                    break;
                   
                default:
                    $this->send_JSON_Response(false, "", "", "Unknown request: " . $input['request']);
                    break;
            }
        } else {
            $this->send_JSON_Response(false, "", "", "Missing 'request' field.");
        }
    }

    private function new_handel_user_create(array $input){
        if(!isset($input['name']) && !isset($input['password'])){
            $this->send_JSON_Response(false, "", "", "Name and password are required.", ['user_created' => false]);
            return;
         }
         $username = $input['name'];
         $password = $input['password'];
         $user = new UserModel($this->db_access);
         $creation_output = $user->new_user_create($username, $password);
        // $creation_output = "blablah";
         $this->send_JSON_Response(true, "Creation request initiated for user: " . $username, "", "", ['user_created' => $creation_output]);
            
    }

     private function handle_create_user(array $input): void
{
    // Validate required field
    if (empty($input['name'])) {
        $this->send_JSON_Response(false, "", "", "Name is required.", ['user_created' => false]);
        return;
    }
   // $mockDBA = null;
   $user_name = $input['name'];
   if(isset($input['password'])){
        $password = $input['password'];
   }
   else {
     $this->send_JSON_Response(true, "Creation request initiated", "No password provided", "", ['user_created' => false]);
     return;
   }

   $user = new UserModel($this->db_access);
   $check_name = $user->get_by_name($user_name);
   if (!empty($check_name)){
     $this->send_JSON_Response(false, "", "", "User already exist", ['user_created' => false]);
     return;
   }
    // Simulate user creation (replace with real logic/DB insert when needed)
    $user->create($user_name,  $password);
    $newUser = [
        
        'name' => $user_name,
        'name_check' => $check_name
      
    ];

    // Success response with the new user data
    $this->send_JSON_Response(
        true,
        "User $user_name created successfully.",
        "",          // you can put a code here if you use it elsewhere
        "",          // message/details field (empty in your example)
        ['user_created' => true]
    );
}   



    private function handle_delete_user(array $input): void{
           if (empty($input['name'])) {
        $this->send_JSON_Response(false, "", "", "Name is required.");
        return;
    }
        $user_name = $input['name'];
        $user = new UserModel($this->db_access);
        $delete_user = $user->delete($user_name);
       $response = null;
       $message ="";
       $warning="";
        if($delete_user===0){
            $response = false;
            $warning="User $user_name does not exist.";
        }
        else
        {   
            $message = "User $user_name deleted.";
            $response = true;
        }    
        $this->send_JSON_Response(true, $message, $warning, "", ['user_deleted' => $response]);
        return;
       
    }


    private function verify_user_password(array $input): void{
         if (empty($input['name'])) {
            $this->send_JSON_Response(false, "", "", "Name is required.");
            return; 
        }
        if(empty($input['password'])){
            $this->send_JSON_Response(false, "", "", "Password is required.");
            return; 
        } 
     $user_name = $input['name'];
     $password = $input['password'];
    $user = new UserModel($this->db_access);
    $verification = $user->verify_user_password($user_name, $password);
  
    $this->send_JSON_Response($verification, "Password verification", "", "",['password_verification'=>$verification]);
            return; 
}

    private function handle_password_reset(array $input): void{
         if (empty($input['name'])) {
            $this->send_JSON_Response(false, "", "", "Name is required.");
            return; 
        }
        if(empty($input['password'])){
            $this->send_JSON_Response(false, "", "", "Password is required.");
            return; 
        } 
     $user_name = $input['name'];
     $password = $input['password'];
    $user = new UserModel($this->db_access);
    $result = $user->reset_user_password($user_name, $password);
  
    $this->send_JSON_Response(true, "Password reset", "", "",['password_reset'=>$result]);
            return; 
}

public function handle_clear_token(array $input): void{
 $message = "Reseting user token";
 $success = false;
 $error = "";
 $warning = "";   
 $user = new UserModel($this->db_access);
 $result = $user->reset_user_token($input['name']);
 $success = true;
 $this->send_JSON_Response($success, $message, $warning, $error, ['token_cleared' => $result]);
}




 public function handle_set_token_and_validity(array $input): void
    {
        $message = "Token and validity creation";
        if (empty($input['name'])) {
            $this->send_JSON_Response(false, $message, "", "Name is required.");
            return; 
        }
        if(empty($input['token'])){
            $this->send_JSON_Response(false, $message, "", "Token is required.");
            return; 
        } 
        if(empty($input['days'])){
            $this->send_JSON_Response(false, $message, "", "Validity is required.");
            return; 
        } 

      
        
        $user = new UserModel($this->db_access);
   
        $result = $user->set_token_and_validity($input['name'], $input['token'], $input['days']);
        if($result){
            $this->send_JSON_Response(true, $message, "", "", ['token_created' => $result]);
        return;}
        else {
            $this->send_JSON_Response(false, $message, "", "Failed to create token.",['token_created' => $result]);
        }
    }



    public function handle_get_user_by_token(array $input){
        $message = "Get user by token";
        $error ="";
        $success = false;
        $warning = "";
        $data = [];
        $result = null;
        
        
        if(empty($input["token"])){
            $error = "Token is required.";
            $this->send_JSON_Response($success, $message, $warning, $error, ['user_found' => $result]);
            return;
        }
   
        $user = new UserModel($this->db_access);
        $result = $user->get_by_token($input["token"]);
       
        if($result){
            $success = true;
            $warning = "";
            $error = "";
            $username = $result[0]['name'];
        }
        else {
            $success = false;
            $warning = "";
            $error = "User not found.";
            $username = null;
        }
        $this->send_JSON_Response($success, $message, $warning, $error, ['user_found' => $username]);
    }

    /**
     * Helper: Get input data (supports JSON body for POST/PUT etc.)
     */
    private function getInputData(): array
    {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
            return $data;
        }

        // Fallback to $_POST if not JSON
        return $_POST;
    }
    
    public function handle_download(){
        if (isset($_GET['file'])) {
            $file = 'uploads/' . basename($_GET['file']);  // Security: prevent directory traversal
    
            if (file_exists($file)) {
                header('Content-Type: application/octet-stream');
                header('Content-Disposition: attachment; filename="' . basename($file) . '"');
                header('Content-Length: ' . filesize($file));
                header('Cache-Control: no-cache');
                
                readfile($file);
                exit;  // Stop all further processing
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'File not found']);
                exit;
            }
        }
    }
    public function handle_rename_file(array $input){
     $file_model = new FileModel($this->db_access);
     $rename_output= $file_model->rename_file($input);
    $this->send_JSON_Response(true, "File renamed MOCK", "", "", ["rename_output" => $rename_output]);
    }

    public function handle_delete_file(array $input){
        $file_model = new FileModel($this->db_access);
        $delete_output = $file_model->delete_file($input);
        $this->send_JSON_Response(true, "File deleted MOCK", "", "", ["delete_output" => $delete_output]);
    }
    public function handle_upload_files(array $input){
        $file_model = new FileModel($this->db_access);
        $upload_output = $file_model->insert_uploaded_files($input);
        $success = $upload_output["success"];
        $message = $upload_output["message"];
        $error = $upload_output["error"];
        $this->send_JSON_Response($success, $message, "", $error, ["upload_output" => $upload_output]);
    }

    /**
     * Send JSON response and exit
     */
    protected function send_JSON_Response(
        bool $success,
        string $message = "",
        string $warning = "",
        string $error = "",
        array $data = []
    ): void {
        header('Content-Type: application/json');

        $response = $this->create_api_response_array($success, $message, $warning, $error, $data);

        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
}