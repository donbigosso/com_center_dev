<?php
    session_start();
    include '../classes/core.php';
    include '../classes/user_model.php';
    include '../classes/db_access.php';

    $db   = getenv('MYSQL_DATABASE');
    $user = getenv('MYSQL_USER');
    $pass = getenv('MYSQL_PASSWORD');
    $core = new Core();
    $dba  = new DatabaseAccess('mysql', $db, $user, $pass);

    // If already logged in, go to dashboard
    $core->auto_log_user($dba);

    $login_error = '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $username = trim($_POST['username'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if ($username === '' || $password === '') {
            $login_error = 'Username and password are required.';
        } else {
            $user_model = new UserModel($dba);

            $password_ok = $user_model->verify_user_password($username, $password);

            if (!$password_ok) {
                $login_error = 'Invalid credentials.';
            } elseif (!$user_model->check_if_admin($username)) {
                $login_error = 'Access denied. Admin only.';
            } else {
                // Check if user already has a valid token
                $user_data = $user_model->get_by_name($username);
                $existing_token = $user_data[0]['token'] ?? '';
                $token_valid = $existing_token && $user_model->check_token_validity($existing_token);

                if ($token_valid) {
                    $session_token = $existing_token;
                } else {
                    // Generate a new token and set validity (14 days)
                    $new_token = bin2hex(random_bytes(16));
                    $user_model->set_token_and_validity($username, $new_token, 14);
                    $session_token = $new_token;
                }

                $_SESSION['token'] = $session_token;
                header('Location: ./');
                exit;
            }
        }
    }
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background-color: #f8f9fa; }
        .login-container { height: 100vh; }
        .logo { width: 200px; height: 200px; object-fit: contain; }
        .card { border-radius: 1rem; }
    </style>
</head>
<body>

<div class="container d-flex justify-content-center align-items-center login-container">
    <div class="col-md-4">
        <div class="text-center mb-4">
            <img src="/images/logo.png" alt="Logo" class="logo">
        </div>

        <div class="card shadow p-4">
            <h3 class="text-center mb-4">Admin login</h3>

            <?php if ($login_error): ?>
                <div class="alert alert-danger"><?php echo htmlspecialchars($login_error); ?></div>
            <?php endif; ?>

            <form action="" method="POST">
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control" id="username" name="username"
                        placeholder="Enter username"
                        value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>"
                        required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <input type="password" class="form-control" id="password" name="password"
                        placeholder="Enter password" required>
                </div>
                <button type="submit" class="btn btn-primary w-100">Sign In</button>
            </form>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>