<?php
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Content-Type");
    include 'classes/core.php';
    include 'classes/db_access.php';
    include 'classes/api_methods.php';
    include 'classes/user_model.php';
    include 'classes/file_model.php';
    include 'classes/gallery_model.php';
    include 'classes/tailored_db_methods_2.php';
    $core = new Core();
    $db   = getenv('MYSQL_DATABASE');
    $user = getenv('MYSQL_USER');
    $pass = getenv('MYSQL_PASSWORD');
    $dba = new DatabaseAccess('mysql', $db, $user, $pass);
    $api = new ApiMethods($dba);
    $api->processRequest(); // This will handle everything and output JSON

?>
