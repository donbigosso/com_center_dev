<?php
class LogModel
{
    protected string $log_folder;
    protected string $log_file;

    public function __construct()
    {
        $this->log_folder = __DIR__ . '/../logs';
        $this->log_file = $this->log_folder . '/command-center.log';
    }

    /**
     * Append one line to command-center.log (creates the file if missing).
     * Fields are taken from arguments only — nothing is read from request/session/DB.
     *
     * Line format: [timestamp] [level] [user] [action] [IP] [status] ;
     * 
     * 
     */
    /* 
    
    
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
