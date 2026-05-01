<?php
    session_start();
    //$_SESSION["token"]= "yair9pt017a6b9vlaez34";
    include '../classes/core.php';
    include '../classes/user_model.php';
    include '../classes/db_access.php';
    include '../classes/tailored_db_methods.php';
    $db   = getenv('MYSQL_DATABASE');
    $user = getenv('MYSQL_USER');
    $pass = getenv('MYSQL_PASSWORD');

    $core = new Core();
    $dba = new DatabaseAccess('mysql', $db, $user, $pass);
    $core->redirect_to_login_screen($dba);
    $username = $core->check_user_for_token($dba);
    $tailored_db_methods = new TailoredDBMethods('mysql', $db, $user, $pass);
    
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel</title>

    <!-- Bootstrap CSS -->
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="../styles.css">
</head>
    
   
</head>
<body>
     <header class="navbar navbar-expand navbar-dark bg-primary shadow-sm">
        <div class="container-fluid">
            <a class="navbar-brand fw-bold fs-4" href="#">
           
            
                <img src="../images/logo.png" alt="Logo" width="60" height="60">
                Donbigosso Admin Panel
            </a>

            <div class="d-flex align-items-center gap-3">
                <span class="text-light me-3 ">
                    <i class="bi bi-person-circle"></i>&nbsp;
                    <strong id="user-field">
                       
                    </strong>
                </span>
               
                <button class="btn btn-outline-danger" id="logout-btn">Logout</button>
            </div>
        </div>
    </header>
 <?php echo ($tailored_db_methods->return_table_for_ui_json('users')); ?>


</body>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script type="module" src="./app.js"></script> 
</html>