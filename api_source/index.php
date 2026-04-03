<?php
echo "<h1>Access Denied!</h1>";
//return;
include 'classes/db_access.php';
include 'classes/core.php';
include 'classes/user_model.php';

echo "<h2>Api source php file</h2>";

$db   = getenv('MYSQL_DATABASE');
$user = getenv('MYSQL_USER');
$pass = getenv('MYSQL_PASSWORD');
$core = new Core();
$db = new DatabaseAccess('mysql', $db, $user, $pass);
$userModel = new UserModel($db);




echo "<br><br>";
$hashed_pwd = password_hash('Mont3Negr0!', PASSWORD_DEFAULT);
// var_dump($db->insert('users', ['name' => 'bigos', 'password' => $hashed_pwd]));

$found_user = $userModel->get_by_name('bigos');
if($found_user){
    print_r($found_user);
}
else
{
    echo "User not found<br>";
}   



echo "<br><br>";

$folder = __DIR__ . '/uploads';
$file = $folder . '/test_file.txt';

phpinfo();



?>
