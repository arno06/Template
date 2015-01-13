<?php
$xml = simplexml_load_file("http://www.eurosport.fr/auto-moto/rss.xml");
$json = json_encode($xml, true);
header("Content-Length:".strlen($json));
header("Content-Type:application/json");
echo $json;
exit();