<?php
if (class_exists('LogModel', false)) {
    return;
}

class LogModel
{
    protected string $log_folder;
    protected string $log_file;

    public function __construct()
    {
        $this->log_folder = __DIR__ . '/../logs';
        $this->log_file = $this->log_folder . '/command-center.log';
    }

    public function client_ip(): string
    {
        $candidates = [
            $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
            $_SERVER['HTTP_CLIENT_IP'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ];
        foreach ($candidates as $value) {
            if (!is_string($value) || $value === '') {
                continue;
            }
            if (strpos($value, ',') !== false) {
                $value = trim(explode(',', $value)[0]);
            }
            return $value !== '' ? $value : '-';
        }
        return '-';
    }

    /**
     * Convenience wrapper: fills timestamp and client IP.
     */
    public function record(string $level, string $user, string $action, string $status): array
    {
        return $this->write_log(
            $level !== '' ? $level : 'INFO',
            $user !== '' ? $user : '-',
            $action !== '' ? $action : '-',
            $this->client_ip(),
            $status !== '' ? $status : '-'
        );
    }

    /**
     * Log a method outcome. Admin actions should pass action with " - admin".
     */
    public function record_result(string $action, bool $success, string $user = '-'): array
    {
        return $this->record(
            $success ? 'INFO' : 'WARN',
            $user,
            $action,
            $success ? 'ok' : 'fail'
        );
    }

    /**
     * Append one line to command-center.log (creates the file if missing).
     *
     * Line format: [timestamp] [level] [user] [action] [IP] [status] ;
     */
    public function write_log(
        string $level,
        string $user,
        string $action,
        string $ip,
        string $status,
        ?string $timestamp = null
    ): array {
        if (!is_dir($this->log_folder) && !mkdir($this->log_folder, 0755, true) && !is_dir($this->log_folder)) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Log folder could not be created.',
            ];
        }

        $timestamp = ($timestamp !== null && $timestamp !== '')
            ? $this->sanitize_log_field($timestamp)
            : date('Y-m-d H:i:s');

        $line = sprintf(
            '[%s] [%s] [%s] [%s] [%s] [%s] ;%s',
            $timestamp,
            $this->sanitize_log_field($level),
            $this->sanitize_log_field($user),
            $this->sanitize_log_field($action),
            $this->sanitize_log_field($ip),
            $this->sanitize_log_field($status),
            PHP_EOL
        );

        $written = file_put_contents($this->log_file, $line, FILE_APPEND | LOCK_EX);
        if ($written === false) {
            return [
                'success' => false,
                'message' => '',
                'error' => 'Failed to write log.',
            ];
        }

        return [
            'success' => true,
            'message' => 'Log written.',
            'error' => '',
            'line' => rtrim($line),
        ];
    }

    private function sanitize_log_field(string $value): string
    {
        return str_replace(["\r", "\n"], ' ', $value);
    }
}
