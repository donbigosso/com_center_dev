<?php
 header("Access-Control-Allow-Origin: *");
  
header('Content-Type: application/json');

$uploadDir = 'uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$maxFiles = 5;
$maxSize  = 10 * 1024 * 1024; // 10 MB per file
$allowed  = ['jpg', 'jpeg', 'png', 'pdf', 'txt', 'docx'];

$errors   = [];
$success  = [];

if (!empty($_FILES['files']['name'][0])) {

    $count = count($_FILES['files']['name']);

    if ($count > $maxFiles) {
        http_response_code(400);
        echo json_encode(['error' => "Maximum $maxFiles files allowed."]);
        exit;
    }

    for ($i = 0; $i < $count; $i++) {

        $name = $_FILES['files']['name'][$i];
        $tmp  = $_FILES['files']['tmp_name'][$i];
        $size = $_FILES['files']['size'][$i];
        $error = $_FILES['files']['error'][$i];

        if ($error !== UPLOAD_ERR_OK) {
            $errors[] = "$name → upload error ($error)";
            continue;
        }

        if ($size > $maxSize) {
            $errors[] = "$name → too big (max 10 MB)";
            continue;
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed)) {
            $errors[] = "$name → not allowed type";
            continue;
        }

        // You can sanitize name here if you want
        $target = $uploadDir . time() . "_" . basename($name);

        if (move_uploaded_file($tmp, $target)) {
            $success[] = $name;
        } else {
            $errors[] = "$name → cannot save";
        }
    }

} else {
    http_response_code(400);
    echo json_encode(['error' => 'No files received']);
    exit;
}

$response = [
    'message' => count($success) ? count($success) . ' file(s) uploaded.' : 'Nothing uploaded.',
    'success' => $success,
    'errors'  => $errors
];

echo json_encode($response);

?>