# DeKa Office

A 3D office for Danny's DeKa bots. Each bot has a desk, and its status comes from `status.json`, which the page re-reads every 5 seconds.

Update a bot's status with `./set-status.sh <bot-id> <idle|working|waiting> "<generic task label>"`.
This page is public, so keep task labels generic: no client names.
