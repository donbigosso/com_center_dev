<?php
    session_start();
    //$_SESSION["token"]= "yair9pt017a6b9vlaez34";
    include '../classes/core.php';
    include '../classes/user_model.php';
    include '../classes/db_access.php';

    $db   = getenv('MYSQL_DATABASE');
    $user = getenv('MYSQL_USER');
    $pass = getenv('MYSQL_PASSWORD');

    $core = new Core();
    $dba = new DatabaseAccess('mysql', $db, $user, $pass);
    $core->redirect_to_login_screen($dba);
    $username = $core->check_user_for_token($dba);

    
?>

<script>
    window.SESSION = {
        token: "<?php echo htmlspecialchars($_SESSION['token'] ?? ''); ?>"
    };
</script>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel</title>
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <!-- Bootstrap CSS -->
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="../styles.css">
</head>
    
   
</head>
<body>
     <header class="navbar-expand navbar-dark shadow-sm navbar" id="admin_navbar">
        <div class="container-fluid">
            <a class="navbar-brand fw-bold fs-4" href="#">
           
            
                <img src="../images/logo.png" alt="Logo" width="60" height="60">
                Donbigosso Admin Panel
            </a>

            <div class="d-flex align-items-center gap-3">
                <span class="text-light me-3 ">
                    <i class="bi bi-person-circle"></i>&nbsp;
                    <strong id="user-field">
                       <?php echo htmlspecialchars($username); ?>
                    </strong>
                </span>
               
                <button class="btn btn-outline-danger" id="logout-btn">Logout</button>
            </div>
        </div>
    </header>
    <!-- Navigation Tiles -->
    <section class="container my-4">
        <h5 class="mb-3 text-muted">Quick Actions</h5>
        <div class="row g-3">
            <div class="col-6 col-md-3">
                <button class="btn w-100 py-4 shadow-sm tile-btn" id="tile-users">
                    <i class="bi bi-people fs-2 d-block mb-2"></i>
                    Show users table
                </button>
            </div>
         
            <div class="col-6 col-md-3">
                <button class="btn w-100 py-4 shadow-sm tile-btn" id="tile-create-user">
                    <i class="bi bi-person-plus  fs-2 d-block mb-2"></i>
                    Create user
                </button>
            </div>
             
            <div class="col-6 col-md-3">
                <button class="btn w-100 py-4 shadow-sm tile-btn" id="tile-delete-user">
                    <i class="bi bi-person-dash fs-2 d-block mb-2"></i>
                    Delete user
                </button>
            </div>
               <div class="col-6 col-md-3">
                <button class="btn w-100 py-4 shadow-sm tile-btn" id="tile-change-password">
                    <i class="bi bi-key fs-2 d-block mb-2"></i>
                    Change password
                </button>
            </div>
            <div class="col-6 col-md-3">
                <button class="btn w-100 py-4 shadow-sm tile-btn" id="tile-media-collections">
                    <i class="bi bi-collection-play fs-2 d-block mb-2"></i>
                    Show media collections table
                </button>
            </div>     <div id="global-feedback" class="global-feedback opacity-0"></div>
        </div>
    

    </section>
 
    
    <div id="result-area" class="p-2" >
            
        </div>
   

 


</body>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script type="module" src="./app.js"></script> 
</html>