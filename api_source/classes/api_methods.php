<?php

class ApiMethods extends Core
{
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
    public function processRequest($core): void
    {
        // Ensure a request method exists
        if (!isset($_SERVER['REQUEST_METHOD'])) {
            $this->send_JSON_Response(false, "", "", "No request method detected.");
            return;
        }

        $method = $_SERVER['REQUEST_METHOD'];

        switch ($method) {
            case 'GET':
                $this->handleGetRequest($core);
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
    protected function handleGetRequest($core): void
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
                    $folder = __DIR__ . '/../uploads';
                    $this->send_JSON_Response(true, "Files requested", "", "", ['files' => $core->create_file_details_table($folder)]);
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
                    if (empty($input['name'])) {
                        $this->send_JSON_Response(false, "", "", "Name is required.");
                        return;
                    }
                    // Simulate creation
                    $newUser = ['id' => 123, 'name' => $input['name']];
                    $this->send_JSON_Response(true, "User created successfully.", "", "", $newUser);
                    break;

                case 'login':
                    // Add login logic here
                    $this->send_JSON_Response(true, "Login successful (mock).", "", "", ['token' => 'abc123']);
                    break;
                case 'verify_user_password':
                    $this->send_JSON_Response(true, "Password verification", "", "",['password_verified'=>true]);
                    break;

                default:
                    $this->send_JSON_Response(false, "", "", "Unknown request: " . $input['request']);
                    break;
            }
        } else {
            $this->send_JSON_Response(false, "", "", "Missing 'request' field.");
        }
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