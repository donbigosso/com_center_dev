<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied</title>

    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <style>
        body {
            background-color: #f8f9fa;
        }
        .denied-container {
            height: 100vh;
        }
        .logo {
            width: 200px;
            height: 200px;
            object-fit: contain;
        }
    </style>
</head>
<body>

<div class="container d-flex justify-content-center align-items-center denied-container">
    <div class="text-center">
        
        <img src="/images/logo.png" alt="Logo" class="logo mb-4">

        <h1 class="display-5 fw-bold text-danger">403 - Access Denied</h1>
        
        <p class="lead mt-3">
            You are not allowed to access this page.
        </p>

       

    </div>
</div>

<!-- Bootstrap JS (optional) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

</body>
</html>