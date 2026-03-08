<?php
class Core
{
  public function JSONencode(array $data): string
  {
      return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  }

  public function JSONdecode(string $json): array
  {
      return json_decode($json, true);
  }

 

}
?>