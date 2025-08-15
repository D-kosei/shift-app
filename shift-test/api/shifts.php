<?php
// CORS（必要に応じて許可ドメインに変更）
$allowed_origin = 'https://'; // 例）'https://yourname.github.io'
header('Access-Control-Allow-Origin: ' . $allowed_origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

$DATA_FILE = __DIR__ . '/../data/shifts.json';
if (!is_dir(dirname($DATA_FILE))) { mkdir(dirname($DATA_FILE), 0775, true); }
if (!file_exists($DATA_FILE)) { file_put_contents($DATA_FILE, json_encode([ 'employees'=>[], 'shifts'=>[] ], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)); }

function read_data($file){
  $fp = fopen($file, 'r'); if(!$fp){ http_response_code(500); echo json_encode(['ok'=>false,'error'=>'open failed']); exit; }
  flock($fp, LOCK_SH); $txt = stream_get_contents($fp); flock($fp, LOCK_UN); fclose($fp);
  $json = json_decode($txt, true); if(!$json) $json=['employees'=>[],'shifts'=>[]]; return $json;
}
function write_data($file, $data){
  $fp = fopen($file, 'c+'); if(!$fp){ http_response_code(500); echo json_encode(['ok'=>false,'error'=>'open failed']); exit; }
  flock($fp, LOCK_EX);
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)); fflush($fp);
  flock($fp, LOCK_UN); fclose($fp);
}
function uuid(){ return bin2hex(random_bytes(16)); }

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
if ($method === 'GET' && $action === 'list') {
  $data = read_data($DATA_FILE);
  echo json_encode(['ok'=>true, 'data'=>$data], JSON_UNESCAPED_UNICODE); exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$act = $input['action'] ?? null;
$data = read_data($DATA_FILE);

try {
  switch ($act) {
    case 'upsert_employee': {
      $item = $input['item'] ?? [];
      $name = trim((string)($item['name'] ?? ''));
      if ($name === '' || mb_strlen($name) > 50) throw new Exception('invalid name');
      $id = $item['id'] ?? uuid();
      $found = false;
      foreach ($data['employees'] as &$e) { if ($e['id'] === $id) { $e['name'] = $name; $found = true; break; } }
      if (!$found) { $data['employees'][] = ['id'=>$id, 'name'=>$name, 'createdAt'=>time()]; }
      write_data($DATA_FILE, $data);
      echo json_encode(['ok'=>true, 'data'=>['id'=>$id,'name'=>$name]], JSON_UNESCAPED_UNICODE); exit;
    }
    case 'delete_employee': {
      $id = (string)($input['id'] ?? ''); if ($id==='') throw new Exception('id required');
      $data['employees'] = array_values(array_filter($data['employees'], fn($e)=> $e['id'] !== $id));
      $data['shifts']    = array_values(array_filter($data['shifts'], fn($s)=> $s['empId'] !== $id));
      write_data($DATA_FILE, $data);
      echo json_encode(['ok'=>true]); exit;
    }
    case 'upsert_shift': {
      $item = $input['item'] ?? [];
      $empId = (string)($item['empId'] ?? '');
      $date  = (string)($item['date']  ?? '');
      $from  = intval($item['fromHour'] ?? -1);
      $to    = intval($item['toHour']   ?? -1);
      $note  = (string)($item['note']   ?? '');
      if ($empId==='' || $date==='') throw new Exception('empId/date required');
      if ($from<0 || $from>23 || $to<1 || $to>24 || $to <= $from) throw new Exception('invalid hours');
      $id = $item['id'] ?? uuid();
      $found = false;
      foreach ($data['shifts'] as &$s) {
        if ($s['id'] === $id) { $s = compact('id','empId','date','from','to','note'); $found = true; break; }
      }
      if (!$found) { $data['shifts'][] = compact('id','empId','date','from','to','note'); }
      write_data($DATA_FILE, $data);
      echo json_encode(['ok'=>true, 'data'=>compact('id','empId','date','from','to','note')], JSON_UNESCAPED_UNICODE); exit;
    }
    case 'delete_shift': {
      $id = (string)($input['id'] ?? ''); if ($id==='') throw new Exception('id required');
      $data['shifts'] = array_values(array_filter($data['shifts'], fn($s)=> $s['id'] !== $id));
      write_data($DATA_FILE, $data); echo json_encode(['ok'=>true]); exit;
    }
    default: throw new Exception('unknown action');
  }
} catch (Throwable $e) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE); exit;
}