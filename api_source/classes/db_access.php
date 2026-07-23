<?php

class DatabaseAccess
{
    private ?PDO $connection = null;  // Allow null, initialize to null
    private bool $connected = false;
    private string $dsn;
    private array $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, // Throw exceptions
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false, // Real prepared statements
    ];

   public function __construct(string $host, string $dbname, string $user, string $pass, string $charset = 'utf8mb4')
{
    $this->dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";
    try {
        $this->connection = new PDO($this->dsn, $user, $pass, $this->options);
        $this->connected = true;
    } catch (PDOException $e) {
        // Log in production, don't expose details
        throw new RuntimeException("Database connection failed");
    }
}

    public function isConnected(): bool
    {
        return $this->connected;
    }

    // Example: secure login check (use password_verify in real app!)
    public function checkCredentials(string $username, string $password): bool
    {
        $stmt = $this->connection->prepare("SELECT password FROM users WHERE name = :username LIMIT 1"); //limit one stops when finding a match
        $stmt->execute([':username' => $username]);
        $row = $stmt->fetch();

        if ($row && password_verify($password, $row['password'])) {
            return true;
        }
        return false;
    }
// Generic method to get all table names
    public function getTableNames(): array
{
    $stmt = $this->connection->query("SHOW TABLES");
    $tables = [];
    
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }
    
    return $tables;
}

    // Generic select with conditions
    public function select(string $table, array $conditions = [], array $columns = ['*']): array
    {
        $sql = "SELECT " . implode(', ', $columns) . " FROM `$table`";
        $params = [];

        if (!empty($conditions)) {
            $where = [];
            foreach ($conditions as $column => $value) {
                $where[] = "`$column` = :$column";
                $params[":$column"] = $value;
            }
            $sql .= " WHERE " . implode(' AND ', $where);
        }

        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }


    // Generic insert
    public function insert(string $table, array $data): int
    {
        $columns = array_keys($data);
        $placeholders = array_map(fn($col) => ":$col", $columns);

        $sql = "INSERT INTO `$table` (`" . implode('`, `', $columns) . "`) VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($data);
        return $this->connection->lastInsertId();
    }

    // Generic update
    public function update(string $table, array $data, array $conditions): bool
    {
        $set = [];
        $params = [];
        foreach ($data as $column => $value) {
            $set[] = "`$column` = :set_$column";
            $params[":set_$column"] = $value;
        }

        $where = [];
        foreach ($conditions as $column => $value) {
            $where[] = "`$column` = :where_$column";
            $params[":where_$column"] = $value;
        }

        $sql = "UPDATE `$table` SET " . implode(', ', $set) . " WHERE " . implode(' AND ', $where);
        $stmt = $this->connection->prepare($sql);
        return $stmt->execute($params);
    }

    // Generic delete
    public function delete(string $table, array $where): int
{
    if (empty($where)) {
        throw new InvalidArgumentException("DELETE requires at least one condition for safety.");
    }

    $conditions = [];
    $params = [];

    foreach ($where as $column => $value) {
        $placeholder = ":where_$column";
        $conditions[] = "`$column` = $placeholder";
        $params[$placeholder] = $value;
    }

    $sql = "DELETE FROM `$table` WHERE " . implode(' AND ', $conditions);

    $stmt = $this->connection->prepare($sql);
    $stmt->execute($params);

    return $stmt->rowCount(); // Returns number of deleted rows
}

    // Describe table
        public function describeTable(string $tableName): array
        {
            try {
                // Safely quote the table name
                $sql = "DESCRIBE `$tableName`";
                
                $stmt = $this->connection->prepare($sql);
                $stmt->execute();
                
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                // Table doesn't exist or other error — return empty array silently
                // In production, you might want to log $e->getMessage()
                return [];
            }
        }


    /**
     * Run a prepared SELECT and return all rows.
     */
    public function queryAll(string $sql, array $params = []): array
    {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Run a prepared query and return a single scalar (first column of first row).
     */
    public function queryValue(string $sql, array $params = [])
    {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        $value = $stmt->fetchColumn();
        return $value === false ? null : $value;
    }

    // Add more methods as needed (delete, table exists, etc.) using the same pattern

    public function __destruct()
    {
        $this->connection = null; // Auto-close
    }
}