<?php

$file = '../raw_data/test-1805.prn';
$file = '../raw_data/boca.prn';

if (file_exists($file)) {
    header('Content-Type: application/octet-stream');
    $data = base64_encode(file_get_contents($file));
    echo $data;
    exit;
}
?>
