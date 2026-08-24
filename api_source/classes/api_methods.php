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
                case 'list_galleries':
                    $this->handle_list_galleries($input);
                    break;
                case 'get_gallery':
                    $this->handle_get_gallery($input);
                    break;
                case 'list_gallery_media':
                    $this->handle_list_gallery_media($input);
                    break;
                case 'get_gallery_media_item':
                    $this->handle_get_gallery_media_item($input);
                    break;
                case 'get_gallery_cover_filename':
                    $this->handle_get_gallery_cover_filename($input);
                    break;
                case 'get_gallery_cover_miniature_filename':
                    $this->handle_get_gallery_cover_miniature_filename($input);
                    break;
                case 'download':
                    $this->handle_download();
                    break;
                 case 'get_iss_position':
                    $this->handle_get_iss_position();
                    break;
                case 'get_astronauts':
                    $this->handle_get_astronauts();
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
                    $this->handle_delete_user_by_admin($input);
                    break;

               
                case 'test':
                    // Add login logic here
                    $this->verify_admin_by_token($input);
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
                case 'reset_password_by_admin':
                    $this->handle_password_reset_by_admin($input);
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
                case 'delete_media_item':
                case 'delete_media_item_by_user':
                    $this->handle_delete_media_item_by_user($input);
                    break;
                case 'delete_media_item_by_admin':
                    $this->handle_delete_media_item_by_admin($input);
                    break;
                case 'upload_files':
                    $this->handle_upload_files($input);
                    break;
                case 'upload_gallery_media':
                    $this->handle_upload_gallery_media($input);
                    break;
                case 'get_file_settings':
                    $this->handle_get_file_settings();
                    break;
                case 'send_table_to_frontend':
                    $this->handle_send_table_to_frontend($input);
                    break;
                case 'create_gallery':
                    $this->handle_create_gallery($input);
                    break;
                case 'update_gallery':
                    $this->handle_update_gallery($input);
                    break;
                case 'delete_gallery':
                    $this->handle_delete_gallery($input);
                    break;
                case 'delete_gallery_by_admin':
                    $this->handle_delete_gallery_by_admin($input);
                    break;
                case 'update_gallery_media':
                    $this->handle_update_gallery_media($input);
                    break;
                case 'remove_media_from_gallery':
                    $this->handle_remove_media_from_gallery($input);
                    break;
                case 'set_gallery_cover':
                    $this->handle_set_gallery_cover($input);
                    break;
                case 'create_contact_message':
                    $this->handle_create_contact_message($input);
                    break;
                case 'list_contact_messages':
                    $this->handle_list_contact_messages($input);
                    break;
                case 'delete_contact_message':
                    $this->handle_delete_contact_message($input);
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

    private function handle_delete_user_by_admin(array $input){
        $user_model = new UserModel($this->db_access);
        $delete_user = $user_model->delete_user_by_admin($input);
        $this->send_JSON_Response($delete_user['success'], $delete_user['message'], $delete_user['error'], "", ['user_deleted' => $delete_user['success']]);
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


private function handle_password_reset_by_admin(array $input): void {
    $user_model = new UserModel($this->db_access);
    $result = $user_model->reset_password_by_admin($input);
    $this->send_JSON_Response($result['success'], $result['message'], $result['error'], "", ['password_reset' => $result['success']]);
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

    /**
     * GET list_galleries — paginated media_collections for the galleries UI.
     * Query params: page (default 1), limit (default 12, max 100),
     *               user (optional username — only that owner's galleries).
     */
    private function handle_list_galleries(array $input): void
    {
        $page = isset($input['page']) ? (int)$input['page'] : 1;
        $limit = isset($input['limit']) ? (int)$input['limit'] : 12;
        $owner = isset($input['user']) ? trim((string)$input['user']) : null;
        if ($owner === '') {
            $owner = null;
        }

        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->list_galleries($page, $limit, $owner);

        $this->send_JSON_Response(
            true,
            'Galleries retrieved successfully.',
            '',
            '',
            $result
        );
    }

    /**
     * GET get_gallery — single media_collection by id (same shape as list_galleries rows).
     * Query params: id (media_collection_id, required).
     */
    private function handle_get_gallery(array $input): void
    {
        $galleryId = isset($input['id']) ? (int)$input['id'] : 0;
        if ($galleryId <= 0) {
            $this->send_JSON_Response(false, '', '', 'Gallery id is required.', ['gallery' => null]);
            return;
        }

        $gallery_model = new GalleryModel($this->db_access);
        $gallery = $gallery_model->get_gallery_by_id($galleryId);

        if ($gallery === null) {
            $this->send_JSON_Response(false, '', '', 'Gallery not found.', ['gallery' => null]);
            return;
        }

        $this->send_JSON_Response(
            true,
            'Gallery retrieved successfully.',
            '',
            '',
            ['gallery' => $gallery]
        );
    }

    /**
     * GET list_gallery_media — paginated media items in a gallery.
     * Query params: id (media_collection_id, required),
     *               page (default 1), limit (default 20, max 100).
     */
    private function handle_list_gallery_media(array $input): void
    {
        $galleryId = isset($input['id']) ? (int)$input['id'] : 0;
        $page = isset($input['page']) ? (int)$input['page'] : 1;
        $limit = isset($input['limit']) ? (int)$input['limit'] : 20;

        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->list_gallery_media($galleryId, $page, $limit);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            [
                'media' => $result['media'],
                'page' => $result['page'],
                'limit' => $result['limit'],
                'total' => $result['total'],
                'has_more' => $result['has_more'],
                'gallery_id' => $result['gallery_id'],
            ]
        );
    }

    /**
     * GET get_gallery_cover_filename — regular cover image filename for a gallery.
     * Query params: id (media_collection_id, required).
     */
    private function handle_get_gallery_cover_filename(array $input): void
    {
        $galleryId = isset($input['id']) ? (int)$input['id'] : 0;
        if ($galleryId <= 0) {
            $this->send_JSON_Response(false, '', '', 'Gallery id is required.', ['filename' => null]);
            return;
        }

        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->get_gallery_cover_filename($galleryId);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['filename' => $result['filename']]
        );
    }

    /**
     * GET get_gallery_cover_miniature_filename — miniature cover filename for a gallery.
     * Query params: id (media_collection_id, required).
     * Miniature is derived as basename + "_sm" + extension (e.g. Image_00001_sm.jpeg).
     */
    private function handle_get_gallery_cover_miniature_filename(array $input): void
    {
        $galleryId = isset($input['id']) ? (int)$input['id'] : 0;
        if ($galleryId <= 0) {
            $this->send_JSON_Response(false, '', '', 'Gallery id is required.', ['filename' => null]);
            return;
        }

        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->get_gallery_cover_miniature_filename($galleryId);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['filename' => $result['filename']]
        );
    }

    /**
     * POST create_gallery — insert media_collections + collection_owners (creator).
     * Body: token, title, description (optional).
     */
    private function handle_create_gallery(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->create_gallery($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['gallery' => $result['gallery']]
        );
    }

    /**
     * POST update_gallery — owner updates title, description, and/or register_date.
     * Body: token, id, optional title, description, register_date (or added_date).
     */
    private function handle_update_gallery(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->update_gallery($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['gallery' => $result['gallery']]
        );
    }

    /**
     * POST delete_gallery — owner deletes a gallery.
     * Body: token, id.
     */
    private function handle_delete_gallery(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->delete_gallery($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error']
        );
    }

    /**
     * POST delete_gallery_by_admin — admin hard-deletes gallery + all its media files.
     * Body: token (admin), id|gallery_id.
     */
    private function handle_delete_gallery_by_admin(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->delete_gallery_by_admin($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            [
                'media_deleted' => $result['media_deleted'] ?? 0,
            ]
        );
    }

    /**
     * GET get_gallery_media_item — one media item in a gallery.
     * Query: gallery_id (or id), media_id (or picid).
     */
    private function handle_get_gallery_media_item(array $input): void
    {
        $galleryId = isset($input['gallery_id'])
            ? (int)$input['gallery_id']
            : (isset($input['id']) ? (int)$input['id'] : 0);
        $mediaId = isset($input['media_id'])
            ? (int)$input['media_id']
            : (isset($input['picid']) ? (int)$input['picid'] : 0);

        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->get_gallery_media_item($galleryId, $mediaId);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['media' => $result['media']]
        );
    }

    /**
     * POST update_gallery_media — owner updates picture title/description.
     * Body: token, gallery_id, media_id, optional title, description.
     */
    private function handle_update_gallery_media(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->update_gallery_media($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['media' => $result['media']]
        );
    }

    /**
     * POST remove_media_from_gallery — owner removes a picture from a gallery.
     * Body: token, gallery_id, media_id.
     */
    private function handle_remove_media_from_gallery(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->remove_media_from_gallery($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error']
        );
    }

    /**
     * POST set_gallery_cover — owner sets collection cover to a gallery media item.
     * Body: token, gallery_id, media_id.
     */
    private function handle_set_gallery_cover(array $input): void
    {
        $gallery_model = new GalleryModel($this->db_access);
        $result = $gallery_model->set_gallery_cover($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            ['gallery' => $result['gallery']]
        );
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

    /**
     * POST delete_media_item / delete_media_item_by_user
     * Body: token, media_item_id|media_id|id (or filename).
     */
    private function handle_delete_media_item_by_user(array $input): void
    {
        $file_model = new FileModel($this->db_access);
        $result = $file_model->delete_media_item_by_user($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            [
                'deleted' => $result['deleted'],
                'media_item_id' => $result['media_item_id'],
                'file_id' => $result['file_id'],
                'filename' => $result['filename'],
                'files_removed' => $result['files_removed'],
            ]
        );
    }

    /**
     * POST delete_media_item_by_admin
     * Body: token (admin), media_item_id|media_id|id (or filename).
     */
    private function handle_delete_media_item_by_admin(array $input): void
    {
        $file_model = new FileModel($this->db_access);
        $result = $file_model->delete_media_item_by_admin($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            [
                'deleted' => $result['deleted'],
                'media_item_id' => $result['media_item_id'],
                'file_id' => $result['file_id'],
                'filename' => $result['filename'],
                'files_removed' => $result['files_removed'],
            ]
        );
    }
    public function handle_get_file_settings(){
        $file_settings = $this->return_file_settings();
        $this->send_JSON_Response(true, "File settings retrieved", "", "", ['UPLOAD_MAX_FILES' => $file_settings['UPLOAD_MAX_FILES'],'UPLOAD_MAX_SIZE_MB' => $file_settings['UPLOAD_MAX_SIZE_MB'],'UPLOAD_ALLOWED_EXTENSIONS' => $file_settings['UPLOAD_ALLOWED_EXTENSIONS']]);
    }

    public function handle_upload_files(array $input){
        $file_model = new FileModel($this->db_access);
        $upload_output = $file_model->insert_uploaded_files($input);
        $success = $upload_output["success"];
        $message = $upload_output["message"];
        $error = $upload_output["error"];
        $uploaded_files = $upload_output["uploaded_files"];
        $this->send_JSON_Response($success, $message, "", $error, ["uploaded_files" => $uploaded_files]);
    }

    /**
     * POST upload_gallery_media — single gallery picture upload (multipart).
     * Fields: token, gallery_id, title, description, file (one image).
     */
    private function handle_upload_gallery_media(array $input): void
    {
        $file_model = new FileModel($this->db_access);
        $result = $file_model->upload_gallery_media($input);

        $this->send_JSON_Response(
            $result['success'],
            $result['message'],
            '',
            $result['error'],
            [
                'media' => $result['media'],
                'gallery_id' => $result['gallery_id'],
            ]
        );
    }

    public function handle_send_table_to_frontend(array $input){
        $s=true;
        $msg="msg";
        $err = "err";
        $wrng="warn";    
        
                   
        $tailored_db_methods = new TailoredDBMethods($this->db_access); 
       
       
        $send_table_output = $tailored_db_methods->send_table_to_frontend($input);

        $success = (bool)($send_table_output["success"] ?? false);
        $message = (string)($send_table_output["message"] ?? "");
        $error = (string)($send_table_output["error"] ?? "");
        // data may be a list-of-rows table; always pass an array (PHP typed param)
        $data = $send_table_output["data"] ?? [];
        if (!is_array($data)) {
            $data = [];
        }
        $this->send_JSON_Response($success, $message, "", $error, $data);
    }

    /**
     * Send JSON response and exit
     */
    /**
     * Server-side proxy for open-notify.org (ISS position).
     * open-notify only serves plain HTTP with no CORS headers, so it
     * can't be called directly from an HTTPS page - we fetch it here
     * server-to-server and pass the JSON through instead.
     */
    private function handle_get_iss_position(): void
    {
        $data = $this->fetch_open_notify('http://api.open-notify.org/iss-now.json');
        if ($data === null) {
            $this->send_JSON_Response(false, "", "", "Failed to fetch ISS position.", []);
            return;
        }
        $this->send_JSON_Response(true, "", "", "", $data);
    }

    private function handle_get_astronauts(): void
    {
        $data = $this->fetch_open_notify('http://api.open-notify.org/astros.json');
        if ($data === null) {
            $this->send_JSON_Response(false, "", "", "Failed to fetch astronaut data.", []);
            return;
        }
        $this->send_JSON_Response(true, "", "", "", $data);
    }

    private function fetch_open_notify(string $url): ?array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => 5,
        ]);
        $response = curl_exec($ch);
        $failed = ($response === false || curl_errno($ch) !== 0);
        curl_close($ch);

        if ($failed) {
            return null;
        }

        $decoded = json_decode($response, true);
        return is_array($decoded) ? $decoded : null;
    }

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


    private function verify_admin_by_token(array $input){
       
        
        $user_model = new UserModel($this->db_access);
      
      
         
       $result = $user_model->verify_admin_by_token($input);
      
        $success= $result['success'];
        $message= $result['message'];
        $error= $result['error'];
        
        $this->send_JSON_Response($success, $message, "", $error, []);
    }
    private function handle_create_contact_message(array $input): void
        {
            $model = new PostAndMessageModel($this->db_access);
            $result = $model->create_contact_message($input);

            $this->send_JSON_Response(
                $result['success'],
                $result['message'],
                '',
                $result['error'],
                ['id' => $result['id']]
            );
        }

    private function handle_list_contact_messages(array $input): void
        {
            $model = new PostAndMessageModel($this->db_access);
            $result = $model->list_contact_messages($input);
            $this->send_JSON_Response(
                $result['success'],
                $result['message'],
                '',
                $result['error'],
                ['messages' => $result['messages']]
            );
        }

    private function handle_delete_contact_message(array $input): void
        {
            $model = new PostAndMessageModel($this->db_access);
            $result = $model->delete_contact_message($input);
            $this->send_JSON_Response(
                $result['success'],
                $result['message'],
                '',
                $result['error']
            );
        }
}