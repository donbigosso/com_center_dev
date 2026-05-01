<?php
    class TailoredDBMethods extends DatabaseAccess {
        public function display_table_as_object(string $table_name): array
        {
          $result = $this->select($table_name);
          return $result;
          // public function select(string $table, array $conditions = [], array $columns = ['*']): array
        }
        public function return_table_as_json(string $table_name): string
        {
          $result = $this->select($table_name);
          return json_encode($result);
        }

        public function return_table_for_ui(string $table_name): array
            {
                $rows = $this->select($table_name);
                if (empty($rows)) {
                    return [];
                }

                $headers = array_keys($rows[0]);
                $values = array_map('array_values', $rows);

                return array_merge([$headers], $values);
            }
        public function return_table_for_ui_json(string $table_name): string
        {
            $result = $this->return_table_for_ui($table_name);
            return json_encode($result);
        }
    }
?>